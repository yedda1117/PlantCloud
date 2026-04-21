package com.plantcloud.plant.service.impl;

import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.plant.client.PlantPredictionClient;
import com.plantcloud.plant.dto.PlantPredictionRequest;
import com.plantcloud.plant.dto.PlantPredictionResponse;
import com.plantcloud.plant.entity.Plant;
import com.plantcloud.plant.mapper.PlantMapper;
import com.plantcloud.plant.service.PlantAiExplanationService;
import com.plantcloud.plant.service.PlantAnalysisService;
import com.plantcloud.plant.service.PlantEnvironmentService;
import com.plantcloud.plant.vo.PlantAnalysisVO;
import com.plantcloud.plant.vo.PlantEnvironmentSnapshotVO;
import com.plantcloud.plant.vo.PlantPredictionAiVO;
import com.plantcloud.system.exception.BizException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class PlantAnalysisServiceImpl implements PlantAnalysisService {

    private static final String ANALYSIS_PROMPT_TEMPLATE = """
        你是“专业的植物养护分析助手”。
        你需要像一个有经验的植物养护顾问一样，根据环境数据进行判断，并给出清晰、可靠的分析和建议。

        你会收到植物当前环境数据、最近1小时变化情况，以及预测模型给出的状态和趋势。
        请基于这些信息，生成专业但易懂的植物分析结果。

        输出必须是 JSON，格式如下：
        {
        "summary": "...",
        "advice": ["...", "..."],
        "riskWarnings": ["...", "..."]
        }

        不要输出解释说明。
        不要输出 markdown。
        不要输出代码块。
        只输出 JSON。

        【语气与表达要求】
        1. 不要使用任何称呼（例如“你”“亲爱的”等）。
        2. 整体语气应专业、冷静、自然，不要过于口语化，也不要像聊天。
        3. 避免过度情绪化表达，不要夸张或拟人化。
        4. 表达应有判断依据，让人感觉结论是基于数据得出的。
        5. 可以适当使用“当前来看”“这种变化可能意味着”等分析型表达。

        【summary 要求】
        1. 用 2~4 句话说明当前环境情况。
        2. 必须结合温度、湿度、光照以及最近1小时变化。
        3. 必须结合“模型预测状态”和“趋势”进行解释。
        4. 要体现环境是稳定、改善还是恶化。
        5. 语气偏分析型，而不是情绪表达。

        【advice 要求】
        1. 返回 2~4 条具体建议（数组形式）。
        2. 每条建议必须是可执行的实际操作。
        3. 避免空泛描述，例如“注意环境变化”。
        4. 表达要清晰直接，例如：
        - 调整摆放位置
        - 控制光照
        - 提升湿度等

        【riskWarnings 要求】
        1. 返回 1~3 条风险提示。
        2. 说明如果当前状态持续，可能对植物造成的具体影响。
        3. 尽量具体到叶片、花期、生长状态等。
        4. 语气保持客观，不要制造紧张感。

        【额外限制】
        1. 不要编造不存在的数据。
        2. 不要输出“首先、其次”等结构化说明。
        3. 不要写成长段说明文。
        4. 必须输出合法 JSON。
        5. advice 和 riskWarnings 必须是数组。

        【输入数据】
        植物名称：%s
        植物品种：%s
        模型预测状态：%s
        模型预测趋势：%s
        当前温度：%s℃
        当前湿度：%s%%
        当前光照：%s lux
        最近1小时温度变化：%s℃
        最近1小时湿度变化：%s%%
        最近1小时光照变化：%s lux
        异常持续时长：%s 小时
        """;

    private final PlantMapper plantMapper;
    private final PlantEnvironmentService plantEnvironmentService;
    private final PlantPredictionClient plantPredictionClient;
    private final PlantAiExplanationService plantAiExplanationService;

    @Override
    public PlantAnalysisVO analyze(Long plantId) {
        Plant plant = requirePlant(plantId);
        PlantEnvironmentSnapshotVO snapshot = plantEnvironmentService.getEnvironmentSnapshot(plantId);
        double abnormalDuration = resolveAbnormalDuration(snapshot);

        PlantPredictionRequest predictionRequest = buildPredictionRequest(plantId, snapshot, abnormalDuration);
        PlantPredictionResponse.PlantPredictionResultDTO prediction = plantPredictionClient.predict(predictionRequest);

        String prompt = ANALYSIS_PROMPT_TEMPLATE.formatted(
                safeText(plant.getPlantName()),
                safeText(plant.getSpecies()),
                safeText(prediction.getStatus()),
                safeText(prediction.getTrend()),
                safeNumber(snapshot.getTemperature()),
                safeNumber(snapshot.getHumidity()),
                safeNumber(snapshot.getLight()),
                safeNumber(snapshot.getTempDelta()),
                safeNumber(snapshot.getHumidityDelta()),
                safeNumber(snapshot.getLightDelta()),
                abnormalDuration
        );

        PlantPredictionAiVO aiResult = plantAiExplanationService.generatePredictionExplanation(prompt);

        PlantAnalysisVO vo = new PlantAnalysisVO();
        vo.setPlantId(plant.getId());
        vo.setPlantName(plant.getPlantName());
        vo.setSpecies(plant.getSpecies());
        vo.setStatus(prediction.getStatus());
        vo.setTrend(prediction.getTrend());
        vo.setSummary(aiResult.getSummary());
        vo.setAdvice(aiResult.getAdvice());
        vo.setRiskWarnings(aiResult.getRiskWarnings());
        return vo;
    }

    private Plant requirePlant(Long plantId) {
        Plant plant = plantMapper.selectById(plantId);
        if (plant == null || !"ACTIVE".equals(plant.getStatus())) {
            throw new BizException(ResultCode.NOT_FOUND.getCode(), "Plant not found");
        }
        return plant;
    }

    private PlantPredictionRequest buildPredictionRequest(Long plantId,
                                                          PlantEnvironmentSnapshotVO snapshot,
                                                          double abnormalDuration) {
        PlantPredictionRequest request = new PlantPredictionRequest();
        request.setPlantType(resolvePlantType(plantId));
        request.setTemp(toDouble(snapshot.getTemperature()));
        request.setHumidity(toDouble(snapshot.getHumidity()));
        request.setLight(toDouble(snapshot.getLight()));
        request.setTempDiff1h(toDouble(snapshot.getTempDelta()));
        request.setHumidityDiff1h(toDouble(snapshot.getHumidityDelta()));
        request.setLightDiff1h(toDouble(snapshot.getLightDelta()));
        request.setAbnormalDuration(abnormalDuration);
        return request;
    }

    private String resolvePlantType(Long plantId) {
        if (Long.valueOf(1L).equals(plantId)) {
            return "phalaenopsis";
        }
        if (Long.valueOf(2L).equals(plantId)) {
            return "succulent";
        }
        throw new BizException(ResultCode.BAD_REQUEST.getCode(), "预测模型植物类型不支持");
    }

    private double resolveAbnormalDuration(PlantEnvironmentSnapshotVO snapshot) {
        if (isNonZero(snapshot.getTempDelta()) || isNonZero(snapshot.getHumidityDelta()) || isNonZero(snapshot.getLightDelta())) {
            return 1.0D;
        }
        return 0.0D;
    }

    private boolean isNonZero(BigDecimal value) {
        return value != null && value.compareTo(BigDecimal.ZERO) != 0;
    }

    private double toDouble(BigDecimal value) {
        return value == null ? 0D : value.doubleValue();
    }

    private String safeText(String value) {
        return value == null ? "" : value;
    }

    private String safeNumber(BigDecimal value) {
        return value == null ? "0" : value.stripTrailingZeros().toPlainString();
    }
}
