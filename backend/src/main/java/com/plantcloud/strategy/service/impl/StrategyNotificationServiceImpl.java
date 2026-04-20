package com.plantcloud.strategy.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.strategy.entity.Strategy;
import com.plantcloud.strategy.entity.UserNotification;
import com.plantcloud.strategy.mapper.StrategyMapper;
import com.plantcloud.strategy.mapper.UserNotificationMapper;
import com.plantcloud.strategy.service.StrategyNotificationService;
import com.plantcloud.system.exception.BizException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class StrategyNotificationServiceImpl implements StrategyNotificationService {

    private final StrategyMapper strategyMapper;
    private final UserNotificationMapper userNotificationMapper;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public void createNotificationByStrategy(Long strategyId, BigDecimal triggerMetricValue, String triggerPayload) {
        // 预留给未来 StrategyEngine 调用的扩展点。
        // 当前 CRUD 阶段不会主动触发该方法，但后续策略执行成功后可直接复用这里的落库逻辑。
        Strategy strategy = strategyMapper.selectById(strategyId);
        if (strategy == null) {
            throw new BizException(ResultCode.NOT_FOUND.getCode(), "策略不存在，无法生成通知");
        }
        if (!"NOTIFY_USER".equals(strategy.getActionType())) {
            return;
        }

        UserNotification notification = new UserNotification();
        notification.setPlantId(strategy.getPlantId());
        notification.setNotificationType(strategy.getActionValue());
        notification.setTitle(buildNotificationTitle(strategy));
        notification.setContent(buildNotificationContent(strategy, triggerMetricValue, triggerPayload));
        userNotificationMapper.insert(notification);
    }

    private String buildNotificationTitle(Strategy strategy) {
        Map<String, Object> config = parseConfig(strategy.getConfigJson());
        Object title = config.get("notifyTitleTemplate");
        if (title != null && StringUtils.hasText(String.valueOf(title))) {
            return String.valueOf(title);
        }
        return "植物策略提醒";
    }

    private String buildNotificationContent(Strategy strategy, BigDecimal triggerMetricValue, String triggerPayload) {
        Map<String, Object> config = parseConfig(strategy.getConfigJson());
        Object content = config.get("notifyContentTemplate");
        if (content != null && StringUtils.hasText(String.valueOf(content))) {
            return String.valueOf(content);
        }
        String metricValueText = triggerMetricValue == null ? "N/A" : triggerMetricValue.toPlainString();
        return "策略[" + strategy.getStrategyName() + "]已触发，指标值：" + metricValueText;
    }

    private Map<String, Object> parseConfig(String configJson) {
        if (!StringUtils.hasText(configJson)) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(configJson, new TypeReference<Map<String, Object>>() {
            });
        } catch (JsonProcessingException ex) {
            throw new BizException(ResultCode.SYSTEM_ERROR.getCode(), "策略通知配置解析失败");
        }
    }
}
