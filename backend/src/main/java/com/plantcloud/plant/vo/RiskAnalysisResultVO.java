package com.plantcloud.plant.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class RiskAnalysisResultVO {

    private Long plantId;
    private String plantName;
    private List<String> riskType;
    private String riskLevel;
    private Integer riskScore;
    private BigDecimal temperature;
    private BigDecimal humidity;
    private BigDecimal light;
    private BigDecimal tempDelta;
    private BigDecimal humidityDelta;
    private BigDecimal lightDelta;
    private List<String> triggerReasons;
    private String aiSummary;
    private String aiAdvice;
    private String aiWarning;
}
