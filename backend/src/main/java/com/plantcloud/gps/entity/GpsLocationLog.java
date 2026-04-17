package com.plantcloud.gps.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("gps_location_logs")
public class GpsLocationLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long deviceId;

    private Double longitude;

    private Double latitude;

    private LocalDateTime createdAt;
}
