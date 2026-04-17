package com.plantcloud.strategy.vo;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class StrategyExecutionLogVO {

    private Long id;
    private Long strategyId;
    private Long plantId;
    private String triggerSource;
    private BigDecimal triggerMetricValue;
    private String triggerPayload;
    private String executionResult;
    private String resultMessage;
    private Long commandLogId;
    private LocalDateTime executedAt;
}
