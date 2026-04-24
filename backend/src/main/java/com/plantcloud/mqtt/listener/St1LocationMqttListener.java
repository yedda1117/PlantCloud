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

    private static final Pattern ST1_TOPIC_PATTERN =
            Pattern.compile("^device/7/st1/alert$");

    private final ObjectMapper objectMapper;
    private final GpsLocationMessageService gpsLocationMessageService;

    private static final Long DEVICE_ID = 7L;

   public void onMessage(String topic, String payload) {

    if (!"device/7/st1/alert".equals(topic)) {
        log.warn("topic not match: {}", topic);
        return;
    }

    try {
        GpsLocationMessage message =
                objectMapper.readValue(payload, GpsLocationMessage.class);

        log.info("GPS received: plantId={}, lon={}, lat={}",
                message.getPlantId(),
                message.getLongitude(),
                message.getLatitude());

        gpsLocationMessageService.handleGpsLocation(
                DEVICE_ID,
                message,
                payload
        );

    } catch (Exception e) {
        log.error("parse failed", e);
    }
}
}
