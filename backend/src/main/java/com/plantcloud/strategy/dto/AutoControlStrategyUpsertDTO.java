package com.plantcloud.strategy.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class AutoControlStrategyUpsertDTO {

    @NotNull
    private Long plantId;
    @NotNull
    private Long targetDeviceId;
    private String metricType;
    private BigDecimal thresholdMin;
    private BigDecimal thresholdMax;
    private String actionCommand;
    private String actionValue;
    private Boolean enabled;
    private Integer priority;
}
