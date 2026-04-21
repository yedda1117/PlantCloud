package com.plantcloud.plant.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.plantcloud.common.model.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;

@Data
@TableName("plants")
@EqualsAndHashCode(callSuper = true)
public class Plant extends BaseEntity {

    private Long ownerId;
    private String plantName;
    private String species;
    private String description;
    private LocalDate plantingDate;
    private String locationDesc;
    private String coverImageUrl;
    private String status;
    private Long templateId;
}
