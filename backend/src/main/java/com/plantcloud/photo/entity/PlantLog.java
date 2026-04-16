package com.plantcloud.photo.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.plantcloud.common.model.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("plant_daily_logs")
@EqualsAndHashCode(callSuper = true)
public class PlantLog extends BaseEntity {

    private Long plantId;
    private LocalDate logDate;
    private String photoUrl;
    private String originPhotoUrl;
    private String note;
    private String milestone;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
