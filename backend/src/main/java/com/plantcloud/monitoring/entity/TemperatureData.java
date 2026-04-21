package com.plantcloud.monitoring.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Temperature data entity.
 * Maps to temperature_data table.
 */
@Data
@TableName("temperature_data")
public class TemperatureData {
    
    @TableId(type = IdType.AUTO)
    private Long id;
    
    private Long plantId;
    
    private Long deviceId;
    
    private BigDecimal temperature;
    
    private String rawPayload;
    
    private LocalDateTime collectedAt;
    
    private LocalDateTime createdAt;
}
