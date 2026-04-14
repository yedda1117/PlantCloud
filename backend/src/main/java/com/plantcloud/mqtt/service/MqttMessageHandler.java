package com.plantcloud.mqtt.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plantcloud.mqtt.listener.MqttUpMessageListener;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
@RequiredArgsConstructor
public class MqttMessageHandler {

    private static final Pattern DEVICE_ALERT_TOPIC_PATTERN =
            Pattern.compile("^device/(\\d+)/sc2/alert$");

    private final ObjectMapper objectMapper;
    private final MqttUpMessageListener mqttUpMessageListener;

    /**
     * Unified MQTT message entry. It keeps the original payload string and
     * delegates business handling to the existing listener.
     */
    public void handleMessage(String topic, String payload) {
        Long deviceId = parseDeviceId(topic);
        JsonNode payloadJson = parsePayload(payload);

        log.info("MQTT message accepted. deviceId={}, topic={}, payload={}",
                deviceId, topic, payloadJson);

        mqttUpMessageListener.onMessage(topic, payload);
    }

    private Long parseDeviceId(String topic) {
        Matcher matcher = DEVICE_ALERT_TOPIC_PATTERN.matcher(topic);
        if (!matcher.matches()) {
            log.warn("MQTT topic ignored because it does not match SC2 alert pattern. topic={}", topic);
            throw new IllegalArgumentException("Unsupported MQTT topic: " + topic);
        }
        return Long.valueOf(matcher.group(1));
    }

    private JsonNode parsePayload(String payload) {
        try {
            return objectMapper.readTree(payload);
        } catch (IOException ex) {
            log.error("MQTT payload is not valid JSON. payload={}", payload, ex);
            throw new IllegalArgumentException("Invalid MQTT payload: " + payload, ex);
        }
    }
}
