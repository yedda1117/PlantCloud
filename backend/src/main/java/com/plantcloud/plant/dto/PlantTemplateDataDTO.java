package com.plantcloud.plant.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class PlantTemplateDataDTO {

    private String plantName;
    private String species;
    private BigDecimal tempMin;
    private BigDecimal tempMax;
    private BigDecimal humidityMin;
    private BigDecimal humidityMax;
    private BigDecimal lightMin;
    private BigDecimal lightMax;
    private BigDecimal tempRiseSensitive;
    private BigDecimal humidityDropSensitive;
    private BigDecimal lightRiseSensitive;
    private String careLevel;
    private String summary;
}
