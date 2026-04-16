package com.plantcloud.strategy.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ScheduleStrategyCreateDTO {

    @NotNull
    private Long plantId;
    @NotNull
    private Long targetDeviceId;
    @NotBlank
    private String strategyName;
    @NotBlank
    private String actionCommand;
    @NotBlank
    private String actionValue;
    @NotBlank
    private String cronExpr;
}
