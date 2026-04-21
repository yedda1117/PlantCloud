package com.plantcloud.plant.service.impl;

import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.plant.dto.PlantTemplateDataDTO;
import com.plantcloud.plant.service.PlantTemplateValidator;
import com.plantcloud.system.exception.BizException;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;

@Component
public class PlantTemplateValidatorImpl implements PlantTemplateValidator {

    private static final BigDecimal ZERO = BigDecimal.ZERO;
    private static final BigDecimal TEMP_MAX_LIMIT = new BigDecimal("45");
    private static final BigDecimal HUMIDITY_MAX_LIMIT = new BigDecimal("100");
    private static final BigDecimal LIGHT_MAX_LIMIT = new BigDecimal("100000");
    private static final BigDecimal SENSITIVE_MAX_LIMIT = BigDecimal.ONE;
    private static final int SUMMARY_MAX_LENGTH = 200;

    @Override
    public void validate(PlantTemplateDataDTO templateData) {
        if (templateData == null) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "templateData不能为空");
        }
        if (!StringUtils.hasText(templateData.getPlantName())) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "植物名称不能为空");
        }

        validateRange(templateData.getTempMin(), templateData.getTempMax(), ZERO, TEMP_MAX_LIMIT, "温度范围不合法");
        validateRange(templateData.getHumidityMin(), templateData.getHumidityMax(), ZERO, HUMIDITY_MAX_LIMIT, "湿度范围不合法");
        validateRange(templateData.getLightMin(), templateData.getLightMax(), ZERO, LIGHT_MAX_LIMIT, "光照范围不合法");

        validateSensitive(templateData.getTempRiseSensitive());
        validateSensitive(templateData.getHumidityDropSensitive());
        validateSensitive(templateData.getLightRiseSensitive());

        if (!isValidCareLevel(templateData.getCareLevel())) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "养护难度仅支持easy、medium、hard");
        }

        if (StringUtils.hasText(templateData.getSummary()) && templateData.getSummary().length() > SUMMARY_MAX_LENGTH) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "养护说明长度不能超过200字");
        }
    }

    private void validateRange(BigDecimal min,
                               BigDecimal max,
                               BigDecimal lowerLimit,
                               BigDecimal upperLimit,
                               String message) {
        if (min == null || max == null
                || min.compareTo(max) >= 0
                || min.compareTo(lowerLimit) < 0
                || max.compareTo(upperLimit) > 0) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), message);
        }
    }

    private void validateSensitive(BigDecimal value) {
        if (value == null || value.compareTo(ZERO) < 0 || value.compareTo(SENSITIVE_MAX_LIMIT) > 0) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "敏感度必须在0到1之间");
        }
    }

    private boolean isValidCareLevel(String careLevel) {
        return "easy".equals(careLevel) || "medium".equals(careLevel) || "hard".equals(careLevel);
    }
}
