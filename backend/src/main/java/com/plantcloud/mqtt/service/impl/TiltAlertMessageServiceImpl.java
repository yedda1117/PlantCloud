package com.plantcloud.mqtt.service.impl;

import com.plantcloud.alert.entity.AlertLog;
import com.plantcloud.alert.mapper.AlertLogMapper;
import com.plantcloud.companion.entity.InteractionEvent;
import com.plantcloud.companion.mapper.InteractionEventMapper;
import com.plantcloud.device.entity.Device;
import com.plantcloud.device.mapper.DeviceMapper;
import com.plantcloud.mqtt.listener.TiltAlertMessage;
import com.plantcloud.mqtt.service.TiltAlertMessageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Slf4j
@Service
@RequiredArgsConstructor
public class TiltAlertMessageServiceImpl implements TiltAlertMessageService {

    private static final String ALERT_TYPE_TILT = "TILT_ABNORMAL";
    private static final String ALERT_SEVERITY_HIGH = "HIGH";
    private static final String ALERT_STATUS_UNRESOLVED = "UNRESOLVED";
    private static final String ALERT_TITLE = "\u68c0\u6d4b\u5230\u690d\u7269\u503e\u659c";
    private static final String ALERT_CONTENT =
            "\u8bbe\u5907\u68c0\u6d4b\u5230\u82b1\u76c6\u53d1\u751f\u503e\u659c\uff0c\u8bf7\u68c0\u67e5\u690d\u7269\u72b6\u6001";

    private static final String EVENT_TYPE_MOTION_DETECTED = "MOTION_DETECTED";
    private static final String EVENT_TITLE = "\u76d1\u6d4b\u5230\u503e\u659c\u52a8\u4f5c";
    private static final String EVENT_CONTENT =
            "\u8bbe\u5907\u68c0\u6d4b\u5230\u82b1\u76c6\u53d1\u751f\u503e\u659c\u52a8\u4f5c";

    private final AlertLogMapper alertLogMapper;
    private final InteractionEventMapper interactionEventMapper;
    private final DeviceMapper deviceMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void handleTiltAlert(Long deviceId, TiltAlertMessage message, String rawPayload) {
        Long plantId = resolvePlantId(deviceId);
        LocalDateTime eventTime = resolveEventTime(message.getTimestamp());
        log.info("Start persisting tilt alert. deviceId={}, plantId={}, eventTime={}",
                deviceId, plantId, eventTime);

        AlertLog alertLog = new AlertLog();
        alertLog.setPlantId(plantId);
        alertLog.setDeviceId(deviceId);
        alertLog.setAlertType(ALERT_TYPE_TILT);
        alertLog.setSeverity(ALERT_SEVERITY_HIGH);
        alertLog.setTitle(ALERT_TITLE);
        alertLog.setContent(ALERT_CONTENT);
        alertLog.setStatus(ALERT_STATUS_UNRESOLVED);
        alertLog.setCreatedAt(eventTime);
        alertLog.setExtraData(rawPayload);
        alertLogMapper.insert(alertLog);
        log.info("Inserted alert_log successfully. alertId={}, deviceId={}, plantId={}, alertType={}",
                alertLog.getId(), deviceId, plantId, ALERT_TYPE_TILT);

        InteractionEvent interactionEvent = new InteractionEvent();
        interactionEvent.setPlantId(plantId);
        interactionEvent.setDeviceId(deviceId);
        interactionEvent.setEventType(EVENT_TYPE_MOTION_DETECTED);
        interactionEvent.setEventTitle(EVENT_TITLE);
        interactionEvent.setEventContent(EVENT_CONTENT);
        interactionEvent.setEventCount(1);
        interactionEvent.setDetectedAt(eventTime);
        interactionEvent.setExtraData("{\"is_tilt\": true}");
        interactionEventMapper.insert(interactionEvent);
        log.info("Inserted interaction_event successfully. eventId={}, deviceId={}, plantId={}, eventType={}",
                interactionEvent.getId(), deviceId, plantId, EVENT_TYPE_MOTION_DETECTED);
    }

    private Long resolvePlantId(Long deviceId) {
        Device device = deviceMapper.selectById(deviceId);
        if (device == null) {
            log.error("Cannot persist tilt alert because device does not exist. deviceId={}", deviceId);
            throw new IllegalArgumentException("Device not found, deviceId=" + deviceId);
        }
        if (device.getPlantId() == null) {
            log.error("Cannot persist tilt alert because device is not bound to a plant. deviceId={}", deviceId);
            throw new IllegalArgumentException("Plant binding missing for deviceId=" + deviceId);
        }
        log.info("Resolved plant relation for tilt alert. deviceId={}, plantId={}", deviceId, device.getPlantId());
        return device.getPlantId();
    }

    private LocalDateTime resolveEventTime(Long timestamp) {
        if (timestamp == null) {
            return LocalDateTime.now();
        }
        return LocalDateTime.ofInstant(Instant.ofEpochSecond(timestamp), ZoneId.systemDefault());
    }
}
