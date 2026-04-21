package com.plantcloud.plant.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class PlantTemplatePublicVO {

    private Long id;
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
}
