package com.plantcloud.monitoring.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Light data entity.
 * Maps to light_data table.
 */
@Data
@TableName("light_data")
public class LightData {
    
    @TableId(type = IdType.AUTO)
    private Long id;
    
    private Long plantId;
    
    private Long deviceId;
    
    private BigDecimal lightLux;
    
    private String rawPayload;
    
    private LocalDateTime collectedAt;
    
    private LocalDateTime createdAt;
}
