package com.plantcloud.strategy.service;

import java.math.BigDecimal;

public interface StrategyNotificationService {

    void createNotificationByStrategy(Long strategyId, BigDecimal triggerMetricValue, String triggerPayload);
}
