package com.plantcloud.plant.service.impl;

import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.plant.dto.PlantAiGenerateRequest;
import com.plantcloud.plant.dto.PlantTemplateDataDTO;
import com.plantcloud.plant.entity.PlantTemplate;
import com.plantcloud.plant.mapper.PlantTemplateMapper;
import com.plantcloud.plant.service.PlantConfigService;
import com.plantcloud.plant.service.PlantTemplateAiService;
import com.plantcloud.plant.service.PlantTemplateValidator;
import com.plantcloud.plant.vo.PlantTemplateGenerateVO;
import com.plantcloud.system.exception.BizException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class PlantConfigServiceImpl implements PlantConfigService {

    private final PlantTemplateMapper plantTemplateMapper;
    private final PlantTemplateAiService plantTemplateAiService;
    private final PlantTemplateValidator plantTemplateValidator;

    @Override
    public PlantTemplateGenerateVO generateTemplate(PlantAiGenerateRequest request) {
        String plantName = normalizePlantName(request.getPlantName());

        PlantTemplate existingTemplate = plantTemplateMapper.selectFirstByPlantName(plantName);
        if (existingTemplate != null) {
            return toGenerateVO(existingTemplate);
        }

        PlantTemplateDataDTO templateData = plantTemplateAiService.generateTemplate(plantName);
        try {
            templateData.setPlantName(plantName);
            plantTemplateValidator.validate(templateData);
        } catch (BizException ex) {
            throw new BizException(ResultCode.AI_PROCESS_FAILED.getCode(), "AI生成参数异常，请重新生成或手动填写");
        }

        return toGenerateVO(templateData);
    }

    private String normalizePlantName(String plantName) {
        if (!StringUtils.hasText(plantName)) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "植物名称不能为空");
        }
        return plantName.trim();
    }

    private PlantTemplateGenerateVO toGenerateVO(PlantTemplate plantTemplate) {
        PlantTemplateGenerateVO vo = new PlantTemplateGenerateVO();
        vo.setFromTemplate(Boolean.TRUE);
        vo.setTemplateId(plantTemplate.getId());
        vo.setSourceType(plantTemplate.getSourceType());
        vo.setPlantName(plantTemplate.getPlantName());
        vo.setSpecies(plantTemplate.getSpecies());
        vo.setTempMin(plantTemplate.getTempMin());
        vo.setTempMax(plantTemplate.getTempMax());
        vo.setHumidityMin(plantTemplate.getHumidityMin());
        vo.setHumidityMax(plantTemplate.getHumidityMax());
        vo.setLightMin(plantTemplate.getLightMin());
        vo.setLightMax(plantTemplate.getLightMax());
        vo.setTempRiseSensitive(plantTemplate.getTempRiseSensitive());
        vo.setHumidityDropSensitive(plantTemplate.getHumidityDropSensitive());
        vo.setLightRiseSensitive(plantTemplate.getLightRiseSensitive());
        vo.setCareLevel(plantTemplate.getCareLevel());
        vo.setSummary(plantTemplate.getSummary());
        return vo;
    }

    private PlantTemplateGenerateVO toGenerateVO(PlantTemplateDataDTO templateData) {
        PlantTemplateGenerateVO vo = new PlantTemplateGenerateVO();
        vo.setFromTemplate(Boolean.FALSE);
        vo.setTemplateId(null);
        vo.setSourceType("AI");
        vo.setPlantName(templateData.getPlantName());
        vo.setSpecies(templateData.getSpecies());
        vo.setTempMin(templateData.getTempMin());
        vo.setTempMax(templateData.getTempMax());
        vo.setHumidityMin(templateData.getHumidityMin());
        vo.setHumidityMax(templateData.getHumidityMax());
        vo.setLightMin(templateData.getLightMin());
        vo.setLightMax(templateData.getLightMax());
        vo.setTempRiseSensitive(templateData.getTempRiseSensitive());
        vo.setHumidityDropSensitive(templateData.getHumidityDropSensitive());
        vo.setLightRiseSensitive(templateData.getLightRiseSensitive());
        vo.setCareLevel(templateData.getCareLevel());
        vo.setSummary(templateData.getSummary());
        return vo;
    }
}
