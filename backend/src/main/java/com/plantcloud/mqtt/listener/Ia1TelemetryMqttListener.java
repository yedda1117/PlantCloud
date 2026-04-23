package com.plantcloud.mqtt.listener;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plantcloud.device.entity.Device;
import com.plantcloud.device.mapper.DeviceMapper;
import com.plantcloud.mqtt.dto.TelemetryPayload;
import com.plantcloud.mqtt.service.impl.TelemetryPersistenceService;
import com.plantcloud.strategy.service.StrategyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * MQTT listener for device/{id}/ia1/telemetry topic.
 * Handles environmental monitoring data from E53_IA1 module.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class Ia1TelemetryMqttListener {

    private static final Pattern IA1_TELEMETRY_TOPIC_PATTERN =
            Pattern.compile("^device/([^/]+)/ia1/telemetry$");
    private static final ZoneId MQTT_EVENT_ZONE = ZoneId.of("Asia/Shanghai");
    private static final long EPOCH_MILLI_THRESHOLD = 100000000000L;
    private static final long MIN_REASONABLE_EPOCH_SECOND = 946656000L;

    private final ObjectMapper objectMapper;
    private final DeviceMapper deviceMapper;
    private final TelemetryPersistenceService telemetryPersistenceService;
    private final StrategyService strategyService;

    /**
     * Async entrance:
     * 1. Parse JSON outside transaction
     * 2. Resolve target device outside transaction
     * 3. Persist telemetry in a short transaction
     */
    @Async("telemetryExecutor")
    public void onMessage(String topic, String payload) {
        try {
            String topicDeviceToken = extractDeviceToken(topic);
            TelemetryPayload telemetry = objectMapper.readValue(payload, TelemetryPayload.class);

            log.info("Received telemetry data. topicDeviceToken={}, temperature={}, humidity={}, lightIntensity={}, fanStatus={}, lightStatus={}",
                    topicDeviceToken,
                    telemetry.getTemperature(),
                    telemetry.getHumidity(),
                    telemetry.getLightIntensity(),
                    telemetry.getFanStatus(),
                    telemetry.getLightStatus());

            Device device = resolveDevice(topicDeviceToken, topic);
            if (device == null) {
                log.warn("Device not found for telemetry data. topicDeviceToken={}", topicDeviceToken);
                return;
            }

            log.info("[STRATEGY_RT] telemetry received: plantId={} light_intensity={} temp={} hum={}",
                    device.getPlantId(),
                    telemetry.getLightIntensity(),
                    telemetry.getTemperature(),
                    telemetry.getHumidity());

            telemetryPersistenceService.persistTelemetry(
                    device,
                    telemetry,
                    payload,
                    resolveCollectedAt(telemetry.getTimestamp())
            );
            log.info("[STRATEGY_RT] telemetry persisted. plantId={}, deviceId={}, temperature={}, humidity={}, lightIntensity={}",
                    device.getPlantId(),
                    device.getId(),
                    telemetry.getTemperature(),
                    telemetry.getHumidity(),
                    telemetry.getLightIntensity());

            evaluateStrategiesAfterTelemetryPersisted(device, telemetry);
        } catch (Exception ex) {
            log.error("Failed to process telemetry message. topic={}, payload={}", topic, payload, ex);
        }
    }

    private void evaluateStrategiesAfterTelemetryPersisted(Device device, TelemetryPayload telemetry) {
        if (device.getPlantId() == null) {
            log.warn("[STRATEGY_RT] strategy evaluation skipped because device is not bound to a plant. deviceId={}",
                    device.getId());
            return;
        }

        Map<String, BigDecimal> realtimeMetricValues = buildRealtimeMetricValues(telemetry);
        if (realtimeMetricValues.isEmpty()) {
            log.warn("[STRATEGY_RT] strategy evaluation skipped because telemetry has no supported metrics. plantId={}, deviceId={}",
                    device.getPlantId(), device.getId());
            return;
        }

        try {
            log.info("[STRATEGY_RT] start strategy evaluation after telemetry persisted. plantId={}, deviceId={}, triggerSource=REALTIME_DATA, metrics={}",
                    device.getPlantId(), device.getId(), realtimeMetricValues);
            strategyService.evaluateStrategiesForPlant(
                    device.getPlantId(),
                    "REALTIME_DATA",
                    realtimeMetricValues
            );
        } catch (Exception ex) {
            log.error("Strategy evaluation failed after telemetry persisted. plantId={}, deviceId={}",
                    device.getPlantId(), device.getId(), ex);
        }
    }

    private Map<String, BigDecimal> buildRealtimeMetricValues(TelemetryPayload telemetry) {
        Map<String, BigDecimal> values = new LinkedHashMap<>();
        if (telemetry.getTemperature() != null) {
            values.put("TEMPERATURE", telemetry.getTemperature());
        }
        if (telemetry.getHumidity() != null) {
            values.put("HUMIDITY", BigDecimal.valueOf(telemetry.getHumidity()));
        }
        if (telemetry.getLightIntensity() != null) {
            values.put("LIGHT", BigDecimal.valueOf(telemetry.getLightIntensity()));
        }
        return values;
    }

    private String extractDeviceToken(String topic) {
        Matcher matcher = IA1_TELEMETRY_TOPIC_PATTERN.matcher(topic);
        if (matcher.matches()) {
            return matcher.group(1);
        }
        throw new IllegalArgumentException("Invalid topic format: " + topic);
    }

    private Device resolveDevice(String topicDeviceToken, String topic) {
        Device device = null;
        if (isNumeric(topicDeviceToken)) {
            device = deviceMapper.selectById(Long.valueOf(topicDeviceToken));
        }
        if (device == null && StringUtils.hasText(topicDeviceToken)) {
            device = deviceMapper.selectOne(
                    new LambdaQueryWrapper<Device>()
                            .eq(Device::getDeviceCode, topicDeviceToken)
                            .last("limit 1")
            );
        }
        if (device == null && StringUtils.hasText(topic)) {
            device = deviceMapper.selectOne(
                    new LambdaQueryWrapper<Device>()
                            .eq(Device::getMqttTopicUp, topic)
                            .last("limit 1")
            );
        }
        return device;
    }

    private LocalDateTime resolveCollectedAt(Long timestamp) {
        if (timestamp == null || timestamp <= 0) {
            return LocalDateTime.now(MQTT_EVENT_ZONE);
        }

        if (timestamp < MIN_REASONABLE_EPOCH_SECOND) {
            LocalDateTime now = LocalDateTime.now(MQTT_EVENT_ZONE);
            log.warn("IA1 MQTT timestamp is too small, using current time. timestamp={}, fallbackTime={}",
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
