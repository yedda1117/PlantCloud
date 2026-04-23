package com.plantcloud.mqtt.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plantcloud.companion.entity.InteractionEvent;
import com.plantcloud.companion.mapper.InteractionEventMapper;
import com.plantcloud.device.entity.Device;
import com.plantcloud.device.mapper.DeviceMapper;
import com.plantcloud.mqtt.listener.HumanApproachMessage;
import com.plantcloud.mqtt.service.HumanApproachMessageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class HumanApproachMessageServiceImpl implements HumanApproachMessageService {

    private static final String EVENT_TYPE_OWNER_APPROACH = "OWNER_APPROACH";
    private static final String EVENT_TITLE_APPROACH = "检测到主人靠近";
    private static final String EVENT_CONTENT_APPROACH = "红外人体传感器检测到主人靠近植物";
    private static final String EVENT_TITLE_LEAVE = "主人已经离开";
    private static final String EVENT_CONTENT_LEAVE = "红外人体传感器检测到主人已离开植物";
    private static final ZoneId EVENT_ZONE = ZoneId.of("Asia/Shanghai");
    private static final long SAME_STATUS_IGNORE_SECONDS = 5L;
    private static final ConcurrentMap<Long, Object> DEVICE_LOCKS = new ConcurrentHashMap<>();

    private final DeviceMapper deviceMapper;
    private final InteractionEventMapper interactionEventMapper;
    private final TransactionTemplate transactionTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public void handleHumanApproach(Long deviceId, HumanApproachMessage message, String rawPayload) {
        Object deviceLock = DEVICE_LOCKS.computeIfAbsent(deviceId, key -> new Object());
        synchronized (deviceLock) {
            transactionTemplate.executeWithoutResult(transactionStatus -> {
                Device device = deviceMapper.selectById(deviceId);
                if (device == null) {
                    throw new IllegalArgumentException("Device not found, deviceId=" + deviceId);
                }
                if (device.getPlantId() == null) {
                    throw new IllegalArgumentException("Plant binding missing for deviceId=" + deviceId);
                }

                Integer currentStatus = normalizeStatus(message.getStatus());
                if (currentStatus == null) {
                    throw new IllegalArgumentException("Human approach status must be 0 or 1, deviceId=" + deviceId);
                }

                InteractionEvent latestEvent = findLatestEvent(deviceId);
                Integer latestStatus = resolveLatestStatus(latestEvent);
                LocalDateTime eventTime = LocalDateTime.now(EVENT_ZONE);
                if (shouldIgnoreEvent(latestEvent, latestStatus, currentStatus, eventTime)) {
                    log.info("Ignored repeated IS1 event because state did not change. deviceId={}, plantId={}, latestStatus={}, currentStatus={}, latestDetectedAt={}, currentEventTime={}",
                            deviceId, device.getPlantId(), latestStatus, currentStatus,
                            latestEvent != null ? latestEvent.getDetectedAt() : null, eventTime);
                    return;
                }

                InteractionEvent event = new InteractionEvent();
                event.setPlantId(device.getPlantId());
                event.setDeviceId(deviceId);
                event.setEventType(EVENT_TYPE_OWNER_APPROACH);
                event.setEventTitle(resolveTitle(currentStatus));
                event.setEventContent(resolveContent(currentStatus));
                event.setEventCount(1);
                event.setDetectedAt(eventTime);
                event.setExtraData(buildEventExtraData(currentStatus, rawPayload));
                interactionEventMapper.insert(event);

                log.info("Inserted IS1 interaction event successfully. eventId={}, plantId={}, deviceId={}, previousStatus={}, currentStatus={}, eventTime={}",
                        event.getId(), event.getPlantId(), deviceId, latestStatus, currentStatus, eventTime);
            });
        }
    }

    private Integer normalizeStatus(Integer status) {
        if (Integer.valueOf(0).equals(status) || Integer.valueOf(1).equals(status)) {
            return status;
        }
        return null;
    }

    private String resolveTitle(Integer status) {
        return Integer.valueOf(1).equals(status) ? EVENT_TITLE_APPROACH : EVENT_TITLE_LEAVE;
    }

    private String resolveContent(Integer status) {
        return Integer.valueOf(1).equals(status) ? EVENT_CONTENT_APPROACH : EVENT_CONTENT_LEAVE;
    }

    private InteractionEvent findLatestEvent(Long deviceId) {
        return interactionEventMapper.selectOne(
                new LambdaQueryWrapper<InteractionEvent>()
                        .eq(InteractionEvent::getDeviceId, deviceId)
                        .eq(InteractionEvent::getEventType, EVENT_TYPE_OWNER_APPROACH)
                        .orderByDesc(InteractionEvent::getDetectedAt)
                        .orderByDesc(InteractionEvent::getId)
                        .last("limit 1")
        );
    }

    private Integer resolveLatestStatus(InteractionEvent latestEvent) {
        if (latestEvent == null) {
            return null;
        }

        Integer latestStatus = extractStatus(latestEvent.getExtraData());
        if (latestStatus != null) {
            return latestStatus;
        }
        if (EVENT_TITLE_APPROACH.equals(latestEvent.getEventTitle())) {
            return 1;
        }
        if (EVENT_TITLE_LEAVE.equals(latestEvent.getEventTitle())) {
            return 0;
        }
        return null;
    }

    private boolean shouldIgnoreEvent(InteractionEvent latestEvent,
                                      Integer latestStatus,
                                      Integer currentStatus,
                                      LocalDateTime currentEventTime) {
        if (latestStatus == null) {
            return Integer.valueOf(0).equals(currentStatus);
        }

        if (!latestStatus.equals(currentStatus)) {
            return false;
        }

        if (latestEvent == null || latestEvent.getDetectedAt() == null) {
            return true;
        }

        return latestEvent.getDetectedAt().plusSeconds(SAME_STATUS_IGNORE_SECONDS).isAfter(currentEventTime);
    }

    private String buildEventExtraData(Integer status, String rawPayload) {
        return String.format("{\"status\":%d,\"rawPayload\":%s}", status, toJsonString(rawPayload));
    }

    private String toJsonString(String value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            log.warn("Failed to serialize IS1 raw payload as JSON string, fallback to empty string.", ex);
            return "\"\"";
        }
    }

    private Integer extractStatus(String extraData) {
        if (extraData == null || extraData.isBlank()) {
            return null;
        }
        try {
            Map<String, Object> data = objectMapper.readValue(extraData, new TypeReference<Map<String, Object>>() {
            });
            Object statusValue = data.get("status");
            if (statusValue instanceof Number number) {
                return number.intValue();
            }
            if (statusValue != null) {
                return Integer.parseInt(String.valueOf(statusValue));
            }
        } catch (Exception ex) {
            log.warn("Failed to parse IS1 event extraData status. extraData={}", extraData, ex);
        }
        return null;
    }
}
