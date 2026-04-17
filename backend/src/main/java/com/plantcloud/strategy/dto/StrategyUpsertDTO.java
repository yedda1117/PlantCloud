package com.plantcloud.strategy.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Map;

@Data
public class StrategyUpsertDTO {

    @NotNull(message = "plantId 不能为空")
    private Long plantId;

    private Long createdBy;

    @NotBlank(message = "strategyName 不能为空")
    private String strategyName;

    @NotBlank(message = "strategyType 不能为空")
    private String strategyType;

    private Long targetDeviceId;

    private String metricType;

    @NotBlank(message = "operatorType 不能为空")
    private String operatorType;

    private BigDecimal thresholdMin;

    private BigDecimal thresholdMax;

    @NotBlank(message = "actionType 不能为空")
    private String actionType;

    @NotBlank(message = "actionValue 不能为空")
    private String actionValue;

    private String cronExpr;

    private Boolean enabled;

    private Integer priority;

    private Boolean timeLimitEnabled;

    private String startTime;

    private String endTime;

    private String notifyTitleTemplate;

    private String notifyContentTemplate;

    /**
     * 兼容前端直接传嵌套 configJson 对象：
     * {
     *   "configJson": {
     *     "timeLimitEnabled": true,
     *     "startTime": "18:00",
     *     "endTime": "22:00"
     *   }
     * }
     */
    private Map<String, Object> configJson;
}
