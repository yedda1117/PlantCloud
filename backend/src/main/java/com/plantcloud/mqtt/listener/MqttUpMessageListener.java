package com.plantcloud.mqtt.listener;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plantcloud.mqtt.service.TiltAlertMessageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
@RequiredArgsConstructor
public class MqttUpMessageListener {

    private static final String TILT_ALERT_TYPE = "tilt_detected";
    private static final Pattern SC2_ALERT_TOPIC_PATTERN =
            Pattern.compile("^device/(\\d+)/sc2/alert$");

    private final ObjectMapper objectMapper;
    private final TiltAlertMessageService tiltAlertMessageService;

    public void onMessage(String topic, String payload) {
        Matcher matcher = SC2_ALERT_TOPIC_PATTERN.matcher(topic);
        if (!matcher.matches()) {
            log.warn("MQTT message skipped because topic is not device/{id}/sc2/alert. topic={}", topic);
            return;
        }

        Long deviceId = Long.valueOf(matcher.group(1));
        try {
            TiltAlertMessage message = objectMapper.readValue(payload, TiltAlertMessage.class);
            log.info("Parsed SC2 alert message. deviceId={}, alertType={}, isTilt={}, timestamp={}",
                    deviceId, message.getAlertType(), message.getIsTilt(), message.getTimestamp());
            if (TILT_ALERT_TYPE.equalsIgnoreCase(message.getAlertType())
                    && Boolean.TRUE.equals(message.getIsTilt())) {
                log.info("Tilt alert matched processing condition. deviceId={}, alertType={}",
                        deviceId, message.getAlertType());
                tiltAlertMessageService.handleTiltAlert(deviceId, message, payload);
            } else {
                log.warn("SC2 alert ignored because condition not matched. deviceId={}, alertType={}, isTilt={}",
                        deviceId, message.getAlertType(), message.getIsTilt());
            }
        } catch (JsonProcessingException ex) {
            log.error("Failed to parse SC2 tilt alert payload. topic={}, payload={}", topic, payload, ex);
        } catch (Exception ex) {
            log.error("Failed to handle SC2 tilt alert. topic={}, payload={}", topic, payload, ex);
        }
    }
}
