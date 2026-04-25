package com.plantcloud.mqtt.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.plantcloud.alert.entity.AlertLog;
import com.plantcloud.alert.mapper.AlertLogMapper;
import com.plantcloud.device.entity.Device;
import com.plantcloud.device.mapper.DeviceMapper;
import com.plantcloud.mqtt.listener.SmokeGasAlertMessage;
import com.plantcloud.mqtt.service.SmokeGasAlertMessageService;
import com.plantcloud.strategy.service.StrategyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class SmokeGasAlertMessageServiceImpl implements SmokeGasAlertMessageService {

    private static final String ALERT_TYPE_SMOKE_GAS = "SMOKE_ABNORMAL";
    private static final String ALERT_STATUS_UNRESOLVED = "UNRESOLVED";
    private static final String ALERT_STATUS_RESOLVED = "RESOLVED";
    private static final String ALERT_SEVERITY_HIGH = "HIGH";
    private static final String ALERT_SEVERITY_CRITICAL = "CRITICAL";
    private static final String METRIC_NAME = "smoke_gas_ppm";
    private static final String ALERT_TITLE = "\u68c0\u6d4b\u5230\u70df\u96fe/\u53ef\u71c3\u6c14\u4f53\u5f02\u5e38";
    private static final String ALERT_CONTENT = "\u70df\u96fe/\u6c14\u4f53\u4f20\u611f\u5668\u68c0\u6d4b\u5230\u7a7a\u6c14\u5f02\u5e38\uff0c\u8bf7\u53ca\u65f6\u68c0\u67e5\u751f\u6001\u7bb1\u5468\u8fb9\u73af\u5883";
    private static final ZoneId MQTT_EVENT_ZONE = ZoneId.of("Asia/Shanghai");
    private static final long EPOCH_MILLI_THRESHOLD = 100000000000L;

    private final AlertLogMapper alertLogMapper;
    private final DeviceMapper deviceMapper;
    private final StrategyService strategyService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void handleSmokeGasAlert(String topicDeviceToken, SmokeGasAlertMessage message, String rawPayload) {
        Device device = resolveDevice(topicDeviceToken, message.getDeviceId());
        if (device.getPlantId() == null) {
            throw new IllegalArgumentException("Plant binding missing for deviceId=" + device.getId());
        }

        LocalDateTime eventTime = resolveEventTime(message.getTimestamp());
        BigDecimal metricValue = resolveMetricValue(message);
        boolean abnormal = isAbnormal(message);
        AlertLog latestUnresolvedAlert = findLatestUnresolvedAlert(device.getId());

        log.info("Evaluating SF1 smoke/gas state. deviceId={}, plantId={}, abnormal={}, hasUnresolved={}, metricValue={}, eventTime={}",
                device.getId(), device.getPlantId(), abnormal, latestUnresolvedAlert != null, metricValue, eventTime);

        Long plantId = device.getPlantId();
        if (abnormal) {
            upsertAbnormalAlert(device, message, rawPayload, eventTime, metricValue, latestUnresolvedAlert);
            strategyService.evaluateStrategiesForPlant(plantId, "SMOKE_ALERT", Map.of());
            return;
        }

        if (latestUnresolvedAlert != null) {
            resolveAlert(latestUnresolvedAlert, rawPayload, eventTime, metricValue);
            strategyService.evaluateStrategiesForPlant(plantId, "SMOKE_ALERT", Map.of());
            return;
        }

        log.info("SF1 smoke/gas state is normal and no unresolved alert exists. deviceId={}, plantId={}",
                device.getId(), plantId);
    }

    private void upsertAbnormalAlert(Device device,
                                     SmokeGasAlertMessage message,
                                     String rawPayload,
                                     LocalDateTime eventTime,
                                     BigDecimal metricValue,
                                     AlertLog latestUnresolvedAlert) {
        if (latestUnresolvedAlert != null) {
            latestUnresolvedAlert.setSeverity(resolveSeverity(message));
            latestUnresolvedAlert.setMetricValue(metricValue);
            latestUnresolvedAlert.setExtraData(rawPayload);
            alertLogMapper.updateById(latestUnresolvedAlert);
            log.info("Updated existing SF1 smoke/gas alert. alertId={}, deviceId={}, plantId={}",
                    latestUnresolvedAlert.getId(), device.getId(), device.getPlantId());
            return;
        }

        AlertLog alertLog = new AlertLog();
        alertLog.setPlantId(device.getPlantId());
        alertLog.setDeviceId(device.getId());
        alertLog.setAlertType(ALERT_TYPE_SMOKE_GAS);
        alertLog.setSeverity(resolveSeverity(message));
        alertLog.setTitle(ALERT_TITLE);
        alertLog.setContent(ALERT_CONTENT);
        alertLog.setMetricName(METRIC_NAME);
        alertLog.setMetricValue(metricValue);
        alertLog.setStatus(ALERT_STATUS_UNRESOLVED);
        alertLog.setCreatedAt(eventTime);
        alertLog.setExtraData(rawPayload);
        alertLogMapper.insert(alertLog);
        log.info("Inserted SF1 smoke/gas alert_log successfully. alertId={}, deviceId={}, plantId={}",
                alertLog.getId(), device.getId(), device.getPlantId());
    }

    private void resolveAlert(AlertLog latestUnresolvedAlert,
                              String rawPayload,
                              LocalDateTime eventTime,
                              BigDecimal metricValue) {
        latestUnresolvedAlert.setStatus(ALERT_STATUS_RESOLVED);
        latestUnresolvedAlert.setResolvedAt(eventTime);
        latestUnresolvedAlert.setMetricValue(metricValue);
        latestUnresolvedAlert.setExtraData(rawPayload);
        alertLogMapper.updateById(latestUnresolvedAlert);
        log.info("Resolved SF1 smoke/gas alert successfully. alertId={}, deviceId={}, plantId={}",
                latestUnresolvedAlert.getId(), latestUnresolvedAlert.getDeviceId(),
                latestUnresolvedAlert.getPlantId());
    }

    private Device resolveDevice(String topicDeviceToken, String payloadDeviceCode) {
        Device device = null;
        if (isNumeric(topicDeviceToken)) {
            device = deviceMapper.selectById(Long.valueOf(topicDeviceToken));
        }
        if (device == null && StringUtils.hasText(payloadDeviceCode)) {
            device = findDeviceByCode(payloadDeviceCode);
        }
        if (device == null && StringUtils.hasText(topicDeviceToken) && !isNumeric(topicDeviceToken)) {
            device = findDeviceByCode(topicDeviceToken);
        }
        if (device == null) {
            throw new IllegalArgumentException("Device not found, topicDeviceToken="
                    + topicDeviceToken + ", payloadDeviceCode=" + payloadDeviceCode);
        }
        return device;
    }

    private Device findDeviceByCode(String deviceCode) {
        return deviceMapper.selectOne(
                new LambdaQueryWrapper<Device>()
                        .eq(Device::getDeviceCode, deviceCode)
                        .last("limit 1")
        );
    }

    private AlertLog findLatestUnresolvedAlert(Long deviceId) {
        return alertLogMapper.selectOne(
                new LambdaQueryWrapper<AlertLog>()
                        .eq(AlertLog::getDeviceId, deviceId)
                        .eq(AlertLog::getAlertType, ALERT_TYPE_SMOKE_GAS)
                        .eq(AlertLog::getStatus, ALERT_STATUS_UNRESOLVED)
                        .orderByDesc(AlertLog::getCreatedAt)
                        .last("limit 1")
        );
    }

    private boolean isAbnormal(SmokeGasAlertMessage message) {
        if (message.getAlarm() != null) {
            return Integer.valueOf(1).equals(message.getAlarm());
        }
        if (StringUtils.hasText(message.getLevel())) {
            return !"NORMAL".equalsIgnoreCase(message.getLevel());
        }
        if (StringUtils.hasText(message.getStatus())) {
            return !"normal".equalsIgnoreCase(message.getStatus());
        }
        return false;
    }

    private String resolveSeverity(SmokeGasAlertMessage message) {
        if ("CRITICAL".equalsIgnoreCase(message.getLevel())
                || "danger".equalsIgnoreCase(message.getStatus())) {
            return ALERT_SEVERITY_CRITICAL;
        }
        return ALERT_SEVERITY_HIGH;
    }

    private BigDecimal resolveMetricValue(SmokeGasAlertMessage message) {
        if (message.getValue() != null) {
            return message.getValue();
        }
        return message.getPpm();
    }

    private LocalDateTime resolveEventTime(Long timestamp) {
        if (timestamp == null || timestamp <= 0) {
            LocalDateTime now = LocalDateTime.now(MQTT_EVENT_ZONE);
            log.warn("SF1 MQTT timestamp missing or invalid, using current time. timestamp={}, fallbackTime={}",
                    timestamp, now);
            return now;
        }

        Instant instant = timestamp >= EPOCH_MILLI_THRESHOLD
                ? Instant.ofEpochMilli(timestamp)
                : Instant.ofEpochSecond(timestamp);
        return LocalDateTime.ofInstant(instant, MQTT_EVENT_ZONE);
    }

    private boolean isNumeric(String value) {
        if (!StringUtils.hasText(value)) {
            return false;
        }
        for (int i = 0; i < value.length(); i++) {
            if (!Character.isDigit(value.charAt(i))) {
                return false;
            }
        }
        return true;
    }
}
