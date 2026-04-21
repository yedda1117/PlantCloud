package com.plantcloud.plant.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.plantcloud.common.model.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("plant_template")
@EqualsAndHashCode(callSuper = true)
public class PlantTemplate extends BaseEntity {

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
    private String sourceType;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
