package com.plantcloud.mqtt.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
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
    private static final String ALERT_STATUS_RESOLVED = "RESOLVED";
    private static final String ALERT_TITLE = "\u68c0\u6d4b\u5230\u690d\u7269\u503e\u659c";
    private static final String ALERT_CONTENT =
            "\u8bbe\u5907\u68c0\u6d4b\u5230\u82b1\u76c6\u53d1\u751f\u503e\u659c\uff0c\u8bf7\u68c0\u67e5\u690d\u7269\u72b6\u6001";

    private static final String EVENT_TYPE_MOTION_DETECTED = "MOTION_DETECTED";
    private static final String EVENT_TITLE_TILT = "\u76d1\u6d4b\u5230\u503e\u659c\u52a8\u4f5c";
    private static final String EVENT_CONTENT_TILT =
            "\u8bbe\u5907\u68c0\u6d4b\u5230\u82b1\u76c6\u53d1\u751f\u503e\u659c\u52a8\u4f5c";
    private static final String EVENT_TITLE_RECOVER = "\u690d\u7269\u503e\u659c\u5df2\u6062\u590d\u6b63\u5e38";
    private static final String EVENT_CONTENT_RECOVER =
            "\u8bbe\u5907\u68c0\u6d4b\u5230\u82b1\u76c6\u5df2\u6062\u590d\u5230\u6b63\u5e38\u72b6\u6001";

    private static final ZoneId MQTT_EVENT_ZONE = ZoneId.of("Asia/Shanghai");
    private static final long EPOCH_MILLI_THRESHOLD = 100000000000L;

    private final AlertLogMapper alertLogMapper;
    private final InteractionEventMapper interactionEventMapper;
    private final DeviceMapper deviceMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public synchronized void handleTiltAlert(Long deviceId, TiltAlertMessage message, String rawPayload) {
        Long plantId = resolvePlantId(deviceId);
        LocalDateTime eventTime = resolveEventTime(message.getTimestamp());
        boolean currentTilt = Boolean.TRUE.equals(message.getIsTilt());
        AlertLog latestAlert = findLatestTiltAlert(deviceId);
        boolean previousTilt = isUnresolved(latestAlert);

        log.info("Evaluating tilt state transition. deviceId={}, plantId={}, previousTilt={}, currentTilt={}, eventTime={}",
                deviceId, plantId, previousTilt, currentTilt, eventTime);

        if (!previousTilt && currentTilt) {
            handleTiltDetected(deviceId, plantId, eventTime, rawPayload);
            return;
        }

        if (previousTilt && !currentTilt) {
            handleTiltRecovered(deviceId, plantId, eventTime, rawPayload, latestAlert);
            return;
        }

        log.info("Tilt state unchanged, no database write required. deviceId={}, plantId={}, previousTilt={}, currentTilt={}",
                deviceId, plantId, previousTilt, currentTilt);
    }

    private void handleTiltDetected(Long deviceId, Long plantId, LocalDateTime eventTime, String rawPayload) {
        log.info("Detected tilt transition false -> true. deviceId={}, plantId={}, eventTime={}",
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
        log.info("Inserted tilt alert_log successfully. alertId={}, deviceId={}, plantId={}",
                alertLog.getId(), deviceId, plantId);

        insertInteractionEvent(
                plantId,
                deviceId,
                EVENT_TITLE_TILT,
                EVENT_CONTENT_TILT,
                eventTime,
                "{\"is_tilt\": true}"
        );
    }

    private void handleTiltRecovered(Long deviceId,
                                     Long plantId,
                                     LocalDateTime eventTime,
                                     String rawPayload,
                                     AlertLog latestUnresolvedAlert) {
        log.info("Detected tilt transition true -> false. deviceId={}, plantId={}, eventTime={}, alertId={}",
                deviceId, plantId, eventTime, latestUnresolvedAlert.getId());

        latestUnresolvedAlert.setStatus(ALERT_STATUS_RESOLVED);
        latestUnresolvedAlert.setResolvedAt(eventTime);
        latestUnresolvedAlert.setExtraData(rawPayload);
        alertLogMapper.updateById(latestUnresolvedAlert);
        log.info("Resolved tilt alert successfully. alertId={}, deviceId={}, plantId={}",
                latestUnresolvedAlert.getId(), deviceId, plantId);

        insertInteractionEvent(
                plantId,
                deviceId,
                EVENT_TITLE_RECOVER,
                EVENT_CONTENT_RECOVER,
                eventTime,
                "{\"is_tilt\": false}"
        );
    }

    private void insertInteractionEvent(Long plantId,
                                        Long deviceId,
                                        String eventTitle,
                                        String eventContent,
                                        LocalDateTime eventTime,
                                        String extraData) {
        InteractionEvent interactionEvent = new InteractionEvent();
        interactionEvent.setPlantId(plantId);
        interactionEvent.setDeviceId(deviceId);
        interactionEvent.setEventType(EVENT_TYPE_MOTION_DETECTED);
        interactionEvent.setEventTitle(eventTitle);
        interactionEvent.setEventContent(eventContent);
        interactionEvent.setEventCount(1);
        interactionEvent.setDetectedAt(eventTime);
        interactionEvent.setExtraData(extraData);
        interactionEventMapper.insert(interactionEvent);
        log.info("Inserted interaction_event successfully. eventId={}, deviceId={}, plantId={}, eventTitle={}",
                interactionEvent.getId(), deviceId, plantId, eventTitle);
    }

    private AlertLog findLatestTiltAlert(Long deviceId) {
        return alertLogMapper.selectOne(
                new LambdaQueryWrapper<AlertLog>()
                        .eq(AlertLog::getDeviceId, deviceId)
                        .eq(AlertLog::getAlertType, ALERT_TYPE_TILT)
                        .orderByDesc(AlertLog::getCreatedAt)
                        .orderByDesc(AlertLog::getId)
                        .last("limit 1")
        );
    }

    private boolean isUnresolved(AlertLog alertLog) {
        return alertLog != null && ALERT_STATUS_UNRESOLVED.equals(alertLog.getStatus());
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
        if (timestamp == null || timestamp <= 0) {
            LocalDateTime now = LocalDateTime.now(MQTT_EVENT_ZONE);
            log.warn("MQTT timestamp missing or invalid, using current time. timestamp={}, fallbackTime={}",
                    timestamp, now);
            return now;
        }

        Instant instant = timestamp >= EPOCH_MILLI_THRESHOLD
                ? Instant.ofEpochMilli(timestamp)
                : Instant.ofEpochSecond(timestamp);
        LocalDateTime eventTime = LocalDateTime.ofInstant(instant, MQTT_EVENT_ZONE);
        log.info("Resolved MQTT event time. rawTimestamp={}, resolvedEventTime={}, zone={}",
                timestamp, eventTime, MQTT_EVENT_ZONE);
        return eventTime;
    }
}
