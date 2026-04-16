package com.plantcloud.strategy.vo;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class StrategyVO {

    private Long id;
    private Long plantId;
    private String strategyName;
    private String strategyType;
    private String metricType;
    private String actionCommand;
    private String actionValue;
    private String cronExpr;
    private Boolean enabled;
    private Integer priority;
}
