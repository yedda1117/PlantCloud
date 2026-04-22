package com.plantcloud.mqtt.listener;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.plantcloud.device.entity.Device;
import com.plantcloud.device.mapper.DeviceMapper;
import com.plantcloud.monitoring.entity.HumidityData;
import com.plantcloud.monitoring.entity.LightData;
import com.plantcloud.monitoring.entity.TemperatureData;
import com.plantcloud.monitoring.mapper.HumidityDataMapper;
import com.plantcloud.monitoring.mapper.LightDataMapper;
import com.plantcloud.monitoring.mapper.TemperatureDataMapper;
import com.plantcloud.mqtt.dto.TelemetryPayload;
import com.plantcloud.mqtt.service.impl.TelemetryPersistenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
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

    // 保留这些 mapper，避免本类中的辅助方法编译失败
    private final TemperatureDataMapper temperatureDataMapper;
    private final HumidityDataMapper humidityDataMapper;
    private final LightDataMapper lightDataMapper;

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

            telemetryPersistenceService.persistTelemetry(
                    device,
                    telemetry,
                    payload,
                    resolveCollectedAt(telemetry.getTimestamp())
            );
        } catch (Exception ex) {
            log.error("Failed to process telemetry message. topic={}, payload={}", topic, payload, ex);
        }
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

    private void saveTemperatureData(Device device, TelemetryPayload telemetry, String rawPayload, LocalDateTime collectedAt) {
        if (telemetry.getTemperature() == null) {
            log.warn("Temperature is null, skipping temperature data save. deviceId={}", device.getId());
            return;
        }

        TemperatureData data = new TemperatureData();
        data.setPlantId(device.getPlantId());
        data.setDeviceId(device.getId());
        data.setTemperature(telemetry.getTemperature());
        data.setRawPayload(rawPayload);
        data.setCollectedAt(collectedAt);
        data.setCreatedAt(LocalDateTime.now());

        temperatureDataMapper.insert(data);

        log.info("Temperature data saved. plantId={}, deviceId={}, temperature={}",
                device.getPlantId(), device.getId(), telemetry.getTemperature());
    }

    private void saveHumidityData(Device device, TelemetryPayload telemetry, String rawPayload, LocalDateTime collectedAt) {
        if (telemetry.getHumidity() == null) {
            log.warn("Humidity is null, skipping humidity data save. deviceId={}", device.getId());
            return;
        }

        HumidityData data = new HumidityData();
        data.setPlantId(device.getPlantId());
        data.setDeviceId(device.getId());
        data.setHumidity(BigDecimal.valueOf(telemetry.getHumidity()));
        data.setRawPayload(rawPayload);
        data.setCollectedAt(collectedAt);
        data.setCreatedAt(LocalDateTime.now());

        humidityDataMapper.insert(data);

        log.info("Humidity data saved. plantId={}, deviceId={}, humidity={}",
                device.getPlantId(), device.getId(), telemetry.getHumidity());
    }

    private void saveLightData(Device device, TelemetryPayload telemetry, String rawPayload, LocalDateTime collectedAt) {
        if (telemetry.getLightIntensity() == null) {
            log.warn("Light intensity is null, skipping light data save. deviceId={}", device.getId());
            return;
        }

        LightData data = new LightData();
        data.setPlantId(device.getPlantId());
        data.setDeviceId(device.getId());
        data.setLightLux(BigDecimal.valueOf(telemetry.getLightIntensity()));
        data.setRawPayload(rawPayload);
        data.setCollectedAt(collectedAt);
        data.setCreatedAt(LocalDateTime.now());

        lightDataMapper.insert(data);

        log.info("Light data saved. plantId={}, deviceId={}, lightLux={}",
                device.getPlantId(), device.getId(), telemetry.getLightIntensity());
    }

    /**
     * Updates device online status, lastSeenAt and currentStatus JSON.
     */
    private void updateDeviceStatus(Device device, TelemetryPayload telemetry) {
        ObjectNode statusNode = buildCurrentStatusNode(device.getCurrentStatus());
        LocalDateTime now = LocalDateTime.now();

        if (telemetry.getFanStatus() != null) {
            statusNode.put("fanStatus", telemetry.getFanStatus());
        }
        if (telemetry.getLightStatus() != null) {
            statusNode.put("lightStatus", telemetry.getLightStatus());
        }
        if (telemetry.getTemperature() != null) {
            statusNode.put("temperature", telemetry.getTemperature());
        }
        if (telemetry.getHumidity() != null) {
            statusNode.put("humidity", telemetry.getHumidity());
        }
        if (telemetry.getLightIntensity() != null) {
            statusNode.put("lightIntensity", telemetry.getLightIntensity());
        }

        statusNode.put("mqttStatus", "ONLINE");
        statusNode.put("online", true);
        statusNode.put("telemetryUpdatedAt", now.toString());
        statusNode.put("statusUpdatedAt", now.toString());
        statusNode.put("stateSource", "TELEMETRY");

        device.setCurrentStatus(statusNode.toString());
        device.setOnlineStatus("ONLINE");
        device.setLastSeenAt(now);
        device.setUpdatedAt(now);

        deviceMapper.updateById(device);

        log.info("Device status updated. deviceId={}, currentStatus={}",
                device.getId(), device.getCurrentStatus());
    }

    /**
     * Builds currentStatus JSON node.
     * If existing current_status is invalid or empty, create a new one.
     */
    private ObjectNode buildCurrentStatusNode(String currentStatus) {
        try {
            if (StringUtils.hasText(currentStatus)) {
                JsonNode node = objectMapper.readTree(currentStatus);
                if (node.isObject()) {
                    return (ObjectNode) node;
                }
            }
        } catch (Exception ex) {
            log.warn("Invalid current_status JSON, will rebuild. currentStatus={}", currentStatus);
        }
        return objectMapper.createObjectNode();
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