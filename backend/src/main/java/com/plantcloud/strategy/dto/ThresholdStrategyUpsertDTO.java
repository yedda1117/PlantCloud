package com.plantcloud.strategy.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ThresholdStrategyUpsertDTO {

    @NotNull
    private Long plantId;
    private BigDecimal thresholdMin;
    private BigDecimal thresholdMax;
    private Boolean enabled;
    private Integer priority;
}
