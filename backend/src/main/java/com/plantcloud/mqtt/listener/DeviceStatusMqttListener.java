package com.plantcloud.mqtt.listener;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.plantcloud.device.entity.Device;
import com.plantcloud.device.mapper.DeviceMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * MQTT listener for device/{deviceCode}/status topic.
 * Payload supports plain text: online / offline.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DeviceStatusMqttListener {

    private static final Pattern DEVICE_STATUS_TOPIC_PATTERN =
            Pattern.compile("^device/([^/]+)/status$");
    private static final String STATUS_ONLINE = "ONLINE";
    private static final String STATUS_OFFLINE = "OFFLINE";

    private final DeviceMapper deviceMapper;
    private final ObjectMapper objectMapper;

    @Transactional(rollbackFor = Exception.class)
    public void onMessage(String topic, String payload) {
        Matcher matcher = DEVICE_STATUS_TOPIC_PATTERN.matcher(topic);
        if (!matcher.matches()) {
            log.warn("MQTT message skipped because topic is not device/{deviceCode}/status. topic={}", topic);
            return;
        }

        String topicDeviceToken = matcher.group(1);
        String onlineStatus = normalizeStatus(payload);
        if (onlineStatus == null) {
            log.warn("Unsupported device status payload. topic={}, payload={}", topic, payload);
            return;
        }

        Device device = resolveDevice(topicDeviceToken);
        if (device == null) {
            log.warn("Device not found for status message. topicDeviceToken={}, payload={}",
                    topicDeviceToken, payload);
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        ObjectNode currentStatus = buildCurrentStatusNode(device.getCurrentStatus());
        currentStatus.put("mqttStatus", onlineStatus);
        currentStatus.put("online", STATUS_ONLINE.equals(onlineStatus));
        currentStatus.put("statusUpdatedAt", now.toString());

        device.setOnlineStatus(onlineStatus);
        device.setCurrentStatus(currentStatus.toString());
        device.setLastSeenAt(now);
        device.setUpdatedAt(now);
        deviceMapper.updateById(device);

        log.info("Device MQTT status updated. deviceId={}, deviceCode={}, onlineStatus={}",
                device.getId(), device.getDeviceCode(), onlineStatus);
    }

    private Device resolveDevice(String topicDeviceToken) {
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
        return device;
    }

    private String normalizeStatus(String payload) {
        if (!StringUtils.hasText(payload)) {
            return null;
        }
        String normalized = payload.trim();
        if (normalized.length() >= 2 && normalized.startsWith("\"") && normalized.endsWith("\"")) {
            normalized = normalized.substring(1, normalized.length() - 1);
        }
        normalized = normalized.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "ONLINE" -> STATUS_ONLINE;
            case "OFFLINE" -> STATUS_OFFLINE;
            default -> null;
        };
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
