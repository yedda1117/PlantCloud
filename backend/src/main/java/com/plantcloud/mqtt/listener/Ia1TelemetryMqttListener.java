package com.plantcloud.mqtt.listener;

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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * MQTT listener for device/{id}/ia1/telemetry topic.
 * Handles environmental monitoring data from E53_IA1 module.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class Ia1TelemetryMqttListener {

    private final ObjectMapper objectMapper;
    private final DeviceMapper deviceMapper;
    private final TemperatureDataMapper temperatureDataMapper;
    private final HumidityDataMapper humidityDataMapper;
    private final LightDataMapper lightDataMapper;

    /**
     * Handles telemetry message from device.
     *
     * @param topic   MQTT topic (e.g. "device/123/ia1/telemetry")
     * @param payload JSON payload string
     */
    @Transactional(rollbackFor = Exception.class)
    public void onMessage(String topic, String payload) {
        try {
            Long deviceId = extractDeviceId(topic);
            TelemetryPayload telemetry = objectMapper.readValue(payload, TelemetryPayload.class);

            log.info("Received telemetry data. deviceId={}, temperature={}, humidity={}, lightIntensity={}, fanStatus={}, lightStatus={}",
                    deviceId,
                    telemetry.getTemperature(),
                    telemetry.getHumidity(),
                    telemetry.getLightIntensity(),
                    telemetry.getFanStatus(),
                    telemetry.getLightStatus());

            Device device = deviceMapper.selectById(deviceId);
            if (device == null) {
                log.warn("Device not found for telemetry data. deviceId={}", deviceId);
                return;
            }

            LocalDateTime collectedAt = telemetry.getTimestamp() != null
                    ? LocalDateTime.ofInstant(
                            Instant.ofEpochSecond(telemetry.getTimestamp()),
                            ZoneId.systemDefault()
                    )
                    : LocalDateTime.now();

            saveTemperatureData(device, telemetry, payload, collectedAt);
            saveHumidityData(device, telemetry, payload, collectedAt);
            saveLightData(device, telemetry, payload, collectedAt);

            updateDeviceStatus(device, telemetry);

        } catch (Exception ex) {
            log.error("Failed to process telemetry message. topic={}, payload={}", topic, payload, ex);
        }
    }

    /**
     * Extracts device ID from topic pattern: device/{id}/ia1/telemetry
     */
    private Long extractDeviceId(String topic) {
        String[] parts = topic.split("/");
        if (parts.length >= 4 && "device".equals(parts[0]) && "ia1".equals(parts[2]) && "telemetry".equals(parts[3])) {
            return Long.parseLong(parts[1]);
        }
        throw new IllegalArgumentException("Invalid topic format: " + topic);
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

        device.setCurrentStatus(statusNode.toString());
        device.setOnlineStatus("ONLINE");
        device.setLastSeenAt(LocalDateTime.now());

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
            if (currentStatus != null && !currentStatus.isBlank()) {
                return (ObjectNode) objectMapper.readTree(currentStatus);
            }
        } catch (Exception ex) {
            log.warn("Invalid current_status JSON, will rebuild. currentStatus={}", currentStatus);
        }
        return objectMapper.createObjectNode();
    }
}