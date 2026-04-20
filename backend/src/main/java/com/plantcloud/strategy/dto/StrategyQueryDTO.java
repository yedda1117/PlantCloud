package com.plantcloud.strategy.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StrategyQueryDTO {

    @NotNull(message = "plantId 不能为空")
    private Long plantId;

    private Boolean enabled;

    private String strategyType;
}
