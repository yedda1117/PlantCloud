package com.plantcloud.plant.service.impl;

import com.plantcloud.plant.dto.PlantCreateRequest;
import com.plantcloud.plant.dto.PlantTemplateDataDTO;
import com.plantcloud.plant.entity.Plant;
import com.plantcloud.plant.entity.PlantTemplate;
import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.plant.mapper.PlantMapper;
import com.plantcloud.plant.mapper.PlantTemplateMapper;
import com.plantcloud.plant.service.PlantAiExplanationService;
import com.plantcloud.plant.service.PlantService;
import com.plantcloud.plant.service.PlantTemplateValidator;
import com.plantcloud.plant.vo.AiExplanationVO;
import com.plantcloud.plant.vo.PlantCreateVO;
import com.plantcloud.plant.vo.PlantRiskProfileVO;
import com.plantcloud.plant.vo.PlantSimpleVO;
import com.plantcloud.plant.vo.RiskAnalysisResultVO;
import com.plantcloud.system.exception.BizException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PlantServiceImpl implements PlantService {

    private static final Long DEFAULT_OWNER_ID = 1L;
    private static final String SOURCE_TYPE_AI = "AI";
    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String HIGH_TEMP_RISK = "HIGH_TEMP_RISK";
    private static final String DRYNESS_RISK = "DRYNESS_RISK";
    private static final String STRONG_LIGHT_RISK = "STRONG_LIGHT_RISK";
    private static final String HOT_DRY_TREND_RISK = "HOT_DRY_TREND_RISK";
    private static final String NO_RISK = "NO_RISK";
    private static final String LOW = "LOW";
    private static final String MEDIUM = "MEDIUM";
    private static final String HIGH = "HIGH";

    private static final BigDecimal ZERO = BigDecimal.ZERO;
    private static final BigDecimal TEN = new BigDecimal("10");
    private static final BigDecimal EIGHT = new BigDecimal("8");
    private static final BigDecimal LIGHT_SCORE_FACTOR = new BigDecimal("0.01");
    private static final BigDecimal TEMP_NEAR_LIMIT_RATE = new BigDecimal("0.9");
    private static final BigDecimal HUMIDITY_NEAR_LIMIT_RATE = new BigDecimal("1.1");
    private static final BigDecimal TREND_TEMP_DELTA_THRESHOLD = new BigDecimal("1.5");
    private static final BigDecimal TREND_HUMIDITY_DELTA_THRESHOLD = new BigDecimal("-5");
    private static final BigDecimal EXTRA_SCORE = new BigDecimal("15");

    private final PlantMapper plantMapper;
    private final PlantTemplateMapper plantTemplateMapper;
    private final PlantAiExplanationService plantAiExplanationService;
    private final PlantTemplateValidator plantTemplateValidator;

    @Override
    public List<PlantSimpleVO> listSimplePlants(Long ownerId) {
        return plantMapper.selectSimplePlants(ownerId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PlantCreateVO createPlant(PlantCreateRequest request) {
        String plantName = normalizePlantName(request.getPlantName());
        PlantTemplateDataDTO templateData = request.getTemplateData();
        templateData.setPlantName(plantName);
        plantTemplateValidator.validate(templateData);

        PlantTemplate plantTemplate = buildPlantTemplate(templateData);
        plantTemplateMapper.insert(plantTemplate);
        if (plantTemplate.getId() == null) {
            throw new BizException(ResultCode.SYSTEM_ERROR.getCode(), "植物模板创建失败");
        }

        Plant plant = new Plant();
        plant.setOwnerId(DEFAULT_OWNER_ID);
        plant.setPlantName(plantName);
        plant.setTemplateId(plantTemplate.getId());
        plant.setStatus(STATUS_ACTIVE);
        plantMapper.insert(plant);
        if (plant.getId() == null) {
            throw new BizException(ResultCode.SYSTEM_ERROR.getCode(), "植物创建失败");
        }

        return new PlantCreateVO(plant.getId(), plantTemplate.getId());
    }

    @Override
    public RiskAnalysisResultVO analyzeRisk(Long plantId) {
        PlantRiskProfileVO profile = requirePlantRiskProfile(plantId);

        BigDecimal latestTemperature = defaultValue(plantMapper.selectLatestTemperature(plantId));
        BigDecimal earliestTemperature = defaultValue(plantMapper.selectEarliestTemperature(plantId));
        BigDecimal latestHumidity = defaultValue(plantMapper.selectLatestHumidity(plantId));
        BigDecimal earliestHumidity = defaultValue(plantMapper.selectEarliestHumidity(plantId));
        BigDecimal latestLight = defaultValue(plantMapper.selectLatestLight(plantId));
        BigDecimal earliestLight = defaultValue(plantMapper.selectEarliestLight(plantId));

        BigDecimal tempDelta = latestTemperature.subtract(earliestTemperature);
        BigDecimal humidityDelta = latestHumidity.subtract(earliestHumidity);
        BigDecimal lightDelta = latestLight.subtract(earliestLight);

        List<String> riskTypes = new ArrayList<>();
        List<String> triggerReasons = new ArrayList<>();

        boolean nearTempUpperLimit = isGreaterThanOrEqual(latestTemperature, multiply(profile.getTempMax(), TEMP_NEAR_LIMIT_RATE));
        boolean nearHumidityLowerLimit = isLessThanOrEqual(latestHumidity, multiply(profile.getHumidityMin(), HUMIDITY_NEAR_LIMIT_RATE));
        boolean nearLightUpperLimit = isGreaterThanOrEqual(latestLight, multiply(profile.getLightMax(), TEMP_NEAR_LIMIT_RATE));

        if (isGreaterThan(latestTemperature, profile.getTempMax())) {
            riskTypes.add(HIGH_TEMP_RISK);
            triggerReasons.add("Current temperature exceeds template temp_max");
        }

        if (isLessThan(latestHumidity, profile.getHumidityMin())) {
            riskTypes.add(DRYNESS_RISK);
            triggerReasons.add("Current humidity is below template humidity_min");
        }

        if (isGreaterThan(latestLight, profile.getLightMax())) {
            riskTypes.add(STRONG_LIGHT_RISK);
            triggerReasons.add("Current light exceeds template light_max");
        }

        if (isGreaterThan(tempDelta, TREND_TEMP_DELTA_THRESHOLD)
                && isLessThan(humidityDelta, TREND_HUMIDITY_DELTA_THRESHOLD)
                && nearTempUpperLimit) {
            riskTypes.add(HOT_DRY_TREND_RISK);
            triggerReasons.add("Temperature is rising, humidity is dropping, and current temperature is close to the upper limit");
        }

        BigDecimal score = calculateRiskScore(profile, tempDelta, humidityDelta, lightDelta);
        if (nearTempUpperLimit) {
            score = score.add(EXTRA_SCORE);
            triggerReasons.add("Current temperature is close to template temp_max");
        }
        if (nearHumidityLowerLimit) {
            score = score.add(EXTRA_SCORE);
            triggerReasons.add("Current humidity is close to template humidity_min");
        }
        if (nearLightUpperLimit) {
            score = score.add(EXTRA_SCORE);
            triggerReasons.add("Current light is close to template light_max");
        }

        RiskAnalysisResultVO result = new RiskAnalysisResultVO();
        result.setPlantId(profile.getPlantId());
        result.setPlantName(profile.getPlantName());
        result.setRiskType(riskTypes.isEmpty() ? List.of(NO_RISK) : riskTypes);
        result.setRiskLevel(resolveRiskLevel(score));
        result.setRiskScore(score.setScale(0, RoundingMode.HALF_UP).intValue());
        result.setTemperature(latestTemperature);
        result.setHumidity(latestHumidity);
        result.setLight(latestLight);
        result.setTempDelta(tempDelta);
        result.setHumidityDelta(humidityDelta);
        result.setLightDelta(lightDelta);
        result.setTriggerReasons(triggerReasons);
        AiExplanationVO ai = plantAiExplanationService.generateExplanation(result);
        result.setAiSummary(ai.getSummary());
        result.setAiAdvice(ai.getAdvice());
        result.setAiWarning(ai.getWarning());
        return result;
    }

    private PlantRiskProfileVO requirePlantRiskProfile(Long plantId) {
        PlantRiskProfileVO profile = plantMapper.selectPlantRiskProfile(plantId);
        if (profile == null) {
            throw new BizException(ResultCode.NOT_FOUND.getCode(), "Plant or plant template not found");
        }
        return profile;
    }

    private BigDecimal calculateRiskScore(PlantRiskProfileVO profile,
                                          BigDecimal tempDelta,
                                          BigDecimal humidityDelta,
                                          BigDecimal lightDelta) {
        BigDecimal temperatureScore = positivePart(tempDelta)
                .multiply(defaultValue(profile.getTempRiseSensitive()))
                .multiply(TEN);
        BigDecimal humidityScore = positivePart(humidityDelta.negate())
                .multiply(defaultValue(profile.getHumidityDropSensitive()))
                .multiply(EIGHT);
        BigDecimal lightScore = positivePart(lightDelta)
                .multiply(defaultValue(profile.getLightRiseSensitive()))
                .multiply(LIGHT_SCORE_FACTOR);
        return temperatureScore.add(humidityScore).add(lightScore);
    }

    private String resolveRiskLevel(BigDecimal score) {
        if (score.compareTo(new BigDecimal("50")) >= 0) {
            return HIGH;
        }
        if (score.compareTo(new BigDecimal("25")) >= 0) {
            return MEDIUM;
        }
        return LOW;
    }

    private BigDecimal positivePart(BigDecimal value) {
        return value.compareTo(ZERO) > 0 ? value : ZERO;
    }

    private BigDecimal defaultValue(BigDecimal value) {
        return value == null ? ZERO : value;
    }

    private BigDecimal multiply(BigDecimal left, BigDecimal right) {
        if (left == null || right == null) {
            return null;
        }
        return left.multiply(right);
    }

    private boolean isGreaterThan(BigDecimal left, BigDecimal right) {
        return left != null && right != null && left.compareTo(right) > 0;
    }

    private boolean isLessThan(BigDecimal left, BigDecimal right) {
        return left != null && right != null && left.compareTo(right) < 0;
    }

    private boolean isGreaterThanOrEqual(BigDecimal left, BigDecimal right) {
        return left != null && right != null && left.compareTo(right) >= 0;
    }

    private boolean isLessThanOrEqual(BigDecimal left, BigDecimal right) {
        return left != null && right != null && left.compareTo(right) <= 0;
    }

    private String normalizePlantName(String plantName) {
        if (!StringUtils.hasText(plantName)) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "植物名称不能为空");
        }
        return plantName.trim();
    }

    private PlantTemplate buildPlantTemplate(PlantTemplateDataDTO templateData) {
        PlantTemplate plantTemplate = new PlantTemplate();
        plantTemplate.setPlantName(templateData.getPlantName());
        plantTemplate.setSpecies(templateData.getSpecies());
        plantTemplate.setTempMin(templateData.getTempMin());
        plantTemplate.setTempMax(templateData.getTempMax());
        plantTemplate.setHumidityMin(templateData.getHumidityMin());
        plantTemplate.setHumidityMax(templateData.getHumidityMax());
        plantTemplate.setLightMin(templateData.getLightMin());
        plantTemplate.setLightMax(templateData.getLightMax());
        plantTemplate.setTempRiseSensitive(templateData.getTempRiseSensitive());
        plantTemplate.setHumidityDropSensitive(templateData.getHumidityDropSensitive());
        plantTemplate.setLightRiseSensitive(templateData.getLightRiseSensitive());
        plantTemplate.setCareLevel(templateData.getCareLevel());
        plantTemplate.setSummary(templateData.getSummary());
        plantTemplate.setSourceType(SOURCE_TYPE_AI);
        return plantTemplate;
    }
}
