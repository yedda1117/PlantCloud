package com.plantcloud.plant.vo;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class PlantCreateVO {

    private Long plantId;
    private Long templateId;
}
