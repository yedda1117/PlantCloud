package com.plantcloud.mqtt.listener;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plantcloud.mqtt.service.SmokeGasAlertMessageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
@RequiredArgsConstructor
public class Sf1AlertMqttListener {

    private static final String SMOKE_GAS_ALERT_TYPE = "smoke_gas_emergency";
    private static final String SMOKE_GAS_EVENT_TYPE = "smoke_gas_detect";
    private static final Pattern SF1_TOPIC_PATTERN =
            Pattern.compile("^device/([^/]+)/sf1/(alert|event)$");

    private final ObjectMapper objectMapper;
    private final SmokeGasAlertMessageService smokeGasAlertMessageService;

    public void onMessage(String topic, String payload) {
        Matcher matcher = SF1_TOPIC_PATTERN.matcher(topic);
        if (!matcher.matches()) {
            log.warn("MQTT message skipped because topic is not device/{id}/sf1/alert or device/{code}/sf1/event. topic={}",
                    topic);
            return;
        }

        String topicDeviceToken = matcher.group(1);
        try {
            SmokeGasAlertMessage message = objectMapper.readValue(payload, SmokeGasAlertMessage.class);
            log.info("Parsed SF1 message. topicDeviceToken={}, alertType={}, eventType={}, value={}, ppm={}, level={}, status={}, alarm={}, timestamp={}",
                    topicDeviceToken, message.getAlertType(), message.getEventType(), message.getValue(),
                    message.getPpm(), message.getLevel(), message.getStatus(), message.getAlarm(),
                    message.getTimestamp());
            if (isSupportedSmokeGasMessage(message)) {
                smokeGasAlertMessageService.handleSmokeGasAlert(topicDeviceToken, message, payload);
            } else {
                log.warn("SF1 message ignored because type is unsupported. topicDeviceToken={}, alertType={}, eventType={}",
                        topicDeviceToken, message.getAlertType(), message.getEventType());
            }
        } catch (JsonProcessingException ex) {
            log.error("Failed to parse SF1 smoke/gas payload. topic={}, payload={}", topic, payload, ex);
        } catch (Exception ex) {
            log.error("Failed to handle SF1 smoke/gas message. topic={}, payload={}", topic, payload, ex);
        }
    }

    private boolean isSupportedSmokeGasMessage(SmokeGasAlertMessage message) {
        return SMOKE_GAS_ALERT_TYPE.equalsIgnoreCase(message.getAlertType())
                || SMOKE_GAS_EVENT_TYPE.equalsIgnoreCase(message.getEventType());
    }
}
