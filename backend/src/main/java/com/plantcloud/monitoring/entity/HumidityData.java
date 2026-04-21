package com.plantcloud.monitoring.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Humidity data entity.
 * Maps to humidity_data table.
 */
@Data
@TableName("humidity_data")
public class HumidityData {
    
    @TableId(type = IdType.AUTO)
    private Long id;
    
    private Long plantId;
    
    private Long deviceId;
    
    private BigDecimal humidity;
    
    private String rawPayload;
    
    private LocalDateTime collectedAt;
    
    private LocalDateTime createdAt;
}
