package com.plantcloud.alert.vo;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class AlertVO {

    private Long id;
    private Long plantId;
    private Long deviceId;
    private String alertType;
    private String severity;
    private String title;
    private String content;
    private String metricName;
    private BigDecimal metricValue;
    private BigDecimal thresholdValue;
    private String status;
    private Long resolvedBy;
    private LocalDateTime resolvedAt;
    private String extraData;
    private LocalDateTime createdAt;
}
