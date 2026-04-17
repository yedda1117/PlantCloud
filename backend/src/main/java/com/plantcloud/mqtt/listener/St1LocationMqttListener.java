package com.plantcloud.mqtt.listener;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plantcloud.mqtt.service.GpsLocationMessageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
@RequiredArgsConstructor
public class St1LocationMqttListener {

    private static final String GPS_LOCATION_ALERT_TYPE = "gps_location";
    private static final Pattern ST1_TOPIC_PATTERN =
            Pattern.compile("^device/(\\d+)/st1/alert$");

    private final ObjectMapper objectMapper;
    private final GpsLocationMessageService gpsLocationMessageService;

    public void onMessage(String topic, String payload) {
        Matcher matcher = ST1_TOPIC_PATTERN.matcher(topic);
        if (!matcher.matches()) {
            log.warn("MQTT message skipped because topic is not device/{{id}}/st1/alert. topic={}", topic);
            return;
        }

        Long deviceId = Long.valueOf(matcher.group(1));
        try {
            GpsLocationMessage message = objectMapper.readValue(payload, GpsLocationMessage.class);
            log.info("Parsed ST1 GPS location message. deviceId={}, longitude={}, latitude={}, timestamp={}",
                    deviceId, message.getLongitude(), message.getLatitude(), message.getTimestamp());

            gpsLocationMessageService.handleGpsLocation(deviceId, message, payload);

        } catch (JsonProcessingException ex) {
            log.error("Failed to parse ST1 GPS location payload. topic={}, payload={}", topic, payload, ex);
        } catch (Exception ex) {
            log.error("Failed to handle ST1 GPS location message. topic={}, payload={}", topic, payload, ex);
        }
    }
}
