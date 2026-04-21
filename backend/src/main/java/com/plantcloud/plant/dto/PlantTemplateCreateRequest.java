package com.plantcloud.plant.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class PlantTemplateCreateRequest {

    @NotBlank(message = "plantName is required")
    private String plantName;

    private String species;

    @NotNull(message = "tempMin is required")
    @DecimalMin(value = "0", message = "tempMin must be greater than or equal to 0")
    @DecimalMax(value = "45", message = "tempMin must be less than or equal to 45")
    private BigDecimal tempMin;

    @NotNull(message = "tempMax is required")
    @DecimalMin(value = "0", message = "tempMax must be greater than or equal to 0")
    @DecimalMax(value = "45", message = "tempMax must be less than or equal to 45")
    private BigDecimal tempMax;

    @NotNull(message = "humidityMin is required")
    @DecimalMin(value = "0", message = "humidityMin must be greater than or equal to 0")
    @DecimalMax(value = "100", message = "humidityMin must be less than or equal to 100")
    private BigDecimal humidityMin;

    @NotNull(message = "humidityMax is required")
    @DecimalMin(value = "0", message = "humidityMax must be greater than or equal to 0")
    @DecimalMax(value = "100", message = "humidityMax must be less than or equal to 100")
    private BigDecimal humidityMax;

    @NotNull(message = "lightMin is required")
    @DecimalMin(value = "0", message = "lightMin must be greater than or equal to 0")
    @DecimalMax(value = "100000", message = "lightMin must be less than or equal to 100000")
    private BigDecimal lightMin;

    @NotNull(message = "lightMax is required")
    @DecimalMin(value = "0", message = "lightMax must be greater than or equal to 0")
    @DecimalMax(value = "100000", message = "lightMax must be less than or equal to 100000")
    private BigDecimal lightMax;

    @NotNull(message = "tempRiseSensitive is required")
    @DecimalMin(value = "0", message = "tempRiseSensitive must be greater than or equal to 0")
    @DecimalMax(value = "1", message = "tempRiseSensitive must be less than or equal to 1")
    private BigDecimal tempRiseSensitive;

    @NotNull(message = "humidityDropSensitive is required")
    @DecimalMin(value = "0", message = "humidityDropSensitive must be greater than or equal to 0")
    @DecimalMax(value = "1", message = "humidityDropSensitive must be less than or equal to 1")
    private BigDecimal humidityDropSensitive;

    @NotNull(message = "lightRiseSensitive is required")
    @DecimalMin(value = "0", message = "lightRiseSensitive must be greater than or equal to 0")
    @DecimalMax(value = "1", message = "lightRiseSensitive must be less than or equal to 1")
    private BigDecimal lightRiseSensitive;
}
