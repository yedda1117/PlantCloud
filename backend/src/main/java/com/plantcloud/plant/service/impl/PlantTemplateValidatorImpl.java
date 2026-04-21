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
            throw badRequest("templateData is required");
        }

        validateRange(
                templateData.getTempMin(),
                templateData.getTempMax(),
                ZERO,
                TEMP_MAX_LIMIT,
                "temperature range is invalid: tempMin must be less than tempMax and both values must be between 0 and 45"
        );
        validateRange(
                templateData.getHumidityMin(),
                templateData.getHumidityMax(),
                ZERO,
                HUMIDITY_MAX_LIMIT,
                "humidity range is invalid: humidityMin must be less than humidityMax and both values must be between 0 and 100"
        );
        validateRange(
                templateData.getLightMin(),
                templateData.getLightMax(),
                ZERO,
                LIGHT_MAX_LIMIT,
                "light range is invalid: lightMin must be less than lightMax and both values must be between 0 and 100000"
        );

        validateSensitive(templateData.getTempRiseSensitive(), "tempRiseSensitive");
        validateSensitive(templateData.getHumidityDropSensitive(), "humidityDropSensitive");
        validateSensitive(templateData.getLightRiseSensitive(), "lightRiseSensitive");

        if (!isValidCareLevel(templateData.getCareLevel())) {
            throw badRequest("careLevel only supports easy, medium, or hard");
        }

        if (StringUtils.hasText(templateData.getSummary()) && templateData.getSummary().length() > SUMMARY_MAX_LENGTH) {
            throw badRequest("summary must not exceed 200 characters");
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
            throw badRequest(message);
        }
    }

    private void validateSensitive(BigDecimal value, String fieldName) {
        if (value == null || value.compareTo(ZERO) < 0 || value.compareTo(SENSITIVE_MAX_LIMIT) > 0) {
            throw badRequest(fieldName + " must be between 0 and 1");
        }
    }

    private boolean isValidCareLevel(String careLevel) {
        return "easy".equals(careLevel) || "medium".equals(careLevel) || "hard".equals(careLevel);
    }

    private BizException badRequest(String message) {
        return new BizException(ResultCode.BAD_REQUEST.getCode(), message);
    }
}
