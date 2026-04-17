package com.plantcloud.strategy.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class StrategyUpsertRequest {

    private Long plantId;
    private Long createdBy;
    private String strategyName;
    private String strategyType;
    private Long targetDeviceId;
    private String metricType;
    private String operatorType;
    private BigDecimal thresholdMin;
    private BigDecimal thresholdMax;
    private String actionType;
    private String actionValue;
    private String cronExpr;
    private Boolean enabled;
    private Integer priority;
    private JsonNode configJson;
}
