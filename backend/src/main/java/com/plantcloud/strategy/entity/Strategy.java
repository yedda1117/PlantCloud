package com.plantcloud.strategy.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.plantcloud.common.model.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@TableName("strategies")
@EqualsAndHashCode(callSuper = true)
public class Strategy extends BaseEntity {

    private Long plantId;
    private Long createdBy;
    private String strategyName;
    private String strategyType;
    private Long targetDeviceId;
    private String metricType;
    private String operatorType;
    private BigDecimal thresholdMin;
    private BigDecimal thresholdMax;
    private String actionCommand;
    private String actionValue;
    private String cronExpr;
    private Boolean enabled;
    private Integer priority;
    private String configJson;
}
