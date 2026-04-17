package com.plantcloud.strategy.vo;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
public class StrategyVO {

    private Long id;
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
    private String configJson;
    private Map<String, Object> config;
    private Boolean timeLimitEnabled;
    private String startTime;
    private String endTime;
    private String notifyTitleTemplate;
    private String notifyContentTemplate;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
