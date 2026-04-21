package com.plantcloud.plant.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class PlantEnvironmentSnapshotVO {

    private Long plantId;
    private BigDecimal temperature;
    private BigDecimal humidity;
    private BigDecimal light;
    private BigDecimal tempDelta;
    private BigDecimal humidityDelta;
    private BigDecimal lightDelta;
}
