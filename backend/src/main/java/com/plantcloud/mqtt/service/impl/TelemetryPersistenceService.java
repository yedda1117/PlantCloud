package com.plantcloud.mqtt.service.impl;

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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class TelemetryPersistenceService {

    private final ObjectMapper objectMapper;
    private final DeviceMapper deviceMapper;
    private final TemperatureDataMapper temperatureDataMapper;
    private final HumidityDataMapper humidityDataMapper;
    private final LightDataMapper lightDataMapper;

    @Transactional(rollbackFor = Exception.class)
    public void persistTelemetry(Device device,
                                 TelemetryPayload telemetry,
                                 String rawPayload,
                                 LocalDateTime collectedAt) {
        saveTemperatureData(device, telemetry, rawPayload, collectedAt);
        saveHumidityData(device, telemetry, rawPayload, collectedAt);
        saveLightData(device, telemetry, rawPayload, collectedAt);
        updateDeviceStatus(device, telemetry);
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
    }

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

        device.setCurrentStatus(statusNode.toString());
        device.setOnlineStatus("ONLINE");
        device.setLastSeenAt(now);
        device.setUpdatedAt(now);
        deviceMapper.updateById(device);
    }

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
}
