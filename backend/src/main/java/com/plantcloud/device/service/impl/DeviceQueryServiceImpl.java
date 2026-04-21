package com.plantcloud.device.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plantcloud.companion.entity.InteractionEvent;
import com.plantcloud.companion.mapper.InteractionEventMapper;
import com.plantcloud.device.entity.Device;
import com.plantcloud.device.mapper.DeviceMapper;
import com.plantcloud.device.service.DeviceQueryService;
import com.plantcloud.device.vo.DevicesStatusVO;
import com.plantcloud.device.vo.InfraredStatusVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DeviceQueryServiceImpl implements DeviceQueryService {

    private static final Long DEFAULT_PLANT_ID = 1L;
    private static final String DEVICE_TYPE_FAN = "FAN";
    private static final String DEVICE_TYPE_FILL_LIGHT = "FILL_LIGHT";
    private static final String DEVICE_TYPE_PIR_SENSOR = "PIR_SENSOR";
    private static final String EVENT_TYPE_OWNER_APPROACH = "OWNER_APPROACH";

    private final DeviceMapper deviceMapper;
    private final InteractionEventMapper interactionEventMapper;
    private final ObjectMapper objectMapper;

    @Override
    public DevicesStatusVO getDevicesStatus(Long plantId) {
        List<Device> devices = deviceMapper.selectList(
                new LambdaQueryWrapper<Device>()
                        .eq(Device::getPlantId, plantId)
                        .in(Device::getDeviceType, List.of(DEVICE_TYPE_FILL_LIGHT, DEVICE_TYPE_FAN, DEVICE_TYPE_PIR_SENSOR))
                        .orderByAsc(Device::getId)
        );

        Device lightDevice = findFirstByType(devices, DEVICE_TYPE_FILL_LIGHT);
        Device fanDevice = findFirstByType(devices, DEVICE_TYPE_FAN);
        Device infraredDevice = findFirstByType(devices, DEVICE_TYPE_PIR_SENSOR);
        InteractionEvent latestInfraredEvent = getLatestInfraredEvent();

        return DevicesStatusVO.builder()
                .plantId(plantId)
                .light(buildCommonStatus(lightDevice))
                .fan(buildCommonStatus(fanDevice))
                .infrared(buildInfraredStatus(infraredDevice, latestInfraredEvent))
                .build();
    }

    @Override
    public InfraredStatusVO getInfraredStatus(String date) {
        LocalDate targetDate = parseDateOrToday(date);
        LocalDateTime start = targetDate.atStartOfDay();
        LocalDateTime end = targetDate.plusDays(1).atStartOfDay();

        Device infraredDevice = deviceMapper.selectOne(
                new LambdaQueryWrapper<Device>()
                        .eq(Device::getPlantId, DEFAULT_PLANT_ID)
                        .eq(Device::getDeviceType, DEVICE_TYPE_PIR_SENSOR)
                        .orderByAsc(Device::getId)
                        .last("limit 1")
        );

        List<InteractionEvent> dayEvents = interactionEventMapper.selectList(
                new LambdaQueryWrapper<InteractionEvent>()
                        .eq(InteractionEvent::getPlantId, DEFAULT_PLANT_ID)
                        .eq(InteractionEvent::getEventType, EVENT_TYPE_OWNER_APPROACH)
                        .between(InteractionEvent::getDetectedAt, start, end)
                        .orderByDesc(InteractionEvent::getDetectedAt)
                        .orderByDesc(InteractionEvent::getId)
        );

        InteractionEvent latestEvent = dayEvents.stream().findFirst().orElseGet(this::getLatestInfraredEvent);
        int approachCount = (int) dayEvents.stream().filter(this::isApproachEvent).count();
        int leaveCount = (int) dayEvents.stream().filter(this::isLeaveEvent).count();

        List<InfraredStatusVO.InfraredEventVO> eventVOList = dayEvents.stream()
                .map(this::toInfraredEventVO)
                .toList();

        return InfraredStatusVO.builder()
                .plantId(DEFAULT_PLANT_ID)
                .deviceId(infraredDevice != null ? infraredDevice.getId() : null)
                .deviceCode(infraredDevice != null ? infraredDevice.getDeviceCode() : null)
                .deviceName(infraredDevice != null ? infraredDevice.getDeviceName() : null)
                .queryDate(targetDate.toString())
                .currentDetected(resolveInfraredDetected(latestEvent))
                .latestEventTitle(latestEvent != null ? latestEvent.getEventTitle() : null)
                .latestEventContent(latestEvent != null ? latestEvent.getEventContent() : null)
                .latestDetectedAt(formatDateTime(latestEvent != null ? latestEvent.getDetectedAt() : null))
                .approachCount(approachCount)
                .leaveCount(leaveCount)
                .events(eventVOList)
                .build();
    }

    private DevicesStatusVO.DeviceRuntimeStatusVO buildCommonStatus(Device device) {
        if (device == null) {
            return DevicesStatusVO.DeviceRuntimeStatusVO.builder()
                    .onlineStatus("UNKNOWN")
                    .workingStatus("UNKNOWN")
                    .build();
        }

        return DevicesStatusVO.DeviceRuntimeStatusVO.builder()
                .deviceId(device.getId())
                .deviceCode(device.getDeviceCode())
                .deviceName(device.getDeviceName())
                .deviceType(device.getDeviceType())
                .onlineStatus(device.getOnlineStatus())
                .workingStatus(resolveWorkingStatus(device.getCurrentStatus()))
                .powerOn(resolvePowerOn(device.getCurrentStatus()))
                .lastSeenAt(formatDateTime(device.getLastSeenAt()))
                .rawStatus(device.getCurrentStatus())
                .build();
    }

    private DevicesStatusVO.InfraredDeviceStatusVO buildInfraredStatus(Device device, InteractionEvent latestEvent) {
        if (device == null) {
            return DevicesStatusVO.InfraredDeviceStatusVO.builder()
                    .onlineStatus("UNKNOWN")
                    .detected(false)
                    .build();
        }

        return DevicesStatusVO.InfraredDeviceStatusVO.builder()
                .deviceId(device.getId())
                .deviceCode(device.getDeviceCode())
                .deviceName(device.getDeviceName())
                .deviceType(device.getDeviceType())
                .onlineStatus(device.getOnlineStatus())
                .detected(resolveInfraredDetected(latestEvent))
                .latestEventTitle(latestEvent != null ? latestEvent.getEventTitle() : null)
                .latestDetectedAt(formatDateTime(latestEvent != null ? latestEvent.getDetectedAt() : null))
                .lastSeenAt(formatDateTime(device.getLastSeenAt()))
                .rawStatus(device.getCurrentStatus())
                .build();
    }

    private InteractionEvent getLatestInfraredEvent() {
        return interactionEventMapper.selectOne(
                new LambdaQueryWrapper<InteractionEvent>()
                        .eq(InteractionEvent::getPlantId, DEFAULT_PLANT_ID)
                        .eq(InteractionEvent::getEventType, EVENT_TYPE_OWNER_APPROACH)
                        .orderByDesc(InteractionEvent::getDetectedAt)
                        .orderByDesc(InteractionEvent::getId)
                        .last("limit 1")
        );
    }

    private Device findFirstByType(List<Device> devices, String deviceType) {
        return devices.stream()
                .filter(device -> deviceType.equalsIgnoreCase(device.getDeviceType()))
                .findFirst()
                .orElse(null);
    }

    private String resolveWorkingStatus(String currentStatus) {
        Map<String, Object> statusMap = parseStatusMap(currentStatus);
        if (statusMap.isEmpty()) {
            if (currentStatus == null || currentStatus.isBlank()) {
                return "UNKNOWN";
            }
            return currentStatus;
        }

        Object power = firstNonNull(statusMap, "power", "status", "switch", "value");
        if (power == null) {
            return "UNKNOWN";
        }
        return String.valueOf(power).toUpperCase(Locale.ROOT);
    }

    private Boolean resolvePowerOn(String currentStatus) {
        Map<String, Object> statusMap = parseStatusMap(currentStatus);
        if (statusMap.isEmpty()) {
            return parseBooleanState(currentStatus);
        }
        Object power = firstNonNull(statusMap, "power", "status", "switch", "value");
        return parseBooleanState(power != null ? String.valueOf(power) : null);
    }

    private boolean resolveInfraredDetected(InteractionEvent event) {
        if (event == null) {
            return false;
        }

        Integer status = extractEventStatus(event.getExtraData());
        if (status != null) {
            return status == 1;
        }

        return !isLeaveEvent(event);
    }

    private Integer extractEventStatus(String extraData) {
        Map<String, Object> data = parseStatusMap(extraData);
        Object status = data.get("status");
        if (status instanceof Number number) {
            return number.intValue();
        }
        if (status != null) {
            try {
                return Integer.parseInt(String.valueOf(status));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private boolean isApproachEvent(InteractionEvent event) {
        Integer status = extractEventStatus(event.getExtraData());
        if (status != null) {
            return status == 1;
        }
        return Optional.ofNullable(event.getEventTitle()).orElse("").contains("来了");
    }

    private boolean isLeaveEvent(InteractionEvent event) {
        Integer status = extractEventStatus(event.getExtraData());
        if (status != null) {
            return status == 0;
        }
        return Optional.ofNullable(event.getEventTitle()).orElse("").contains("离开");
    }

    private InfraredStatusVO.InfraredEventVO toInfraredEventVO(InteractionEvent event) {
        return InfraredStatusVO.InfraredEventVO.builder()
                .id(event.getId())
                .eventType(event.getEventType())
                .eventTitle(event.getEventTitle())
                .eventContent(event.getEventContent())
                .status(extractEventStatus(event.getExtraData()))
                .detectedAt(formatDateTime(event.getDetectedAt()))
                .extraData(event.getExtraData())
                .build();
    }

    private Map<String, Object> parseStatusMap(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyMap();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (Exception ignored) {
            return Collections.emptyMap();
        }
    }

    private Object firstNonNull(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            if (map.containsKey(key) && map.get(key) != null) {
                return map.get(key);
            }
        }
        return null;
    }

    private Boolean parseBooleanState(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "ON", "OPEN", "RUNNING", "1", "TRUE" -> true;
            case "OFF", "CLOSE", "STOPPED", "0", "FALSE" -> false;
            default -> null;
        };
    }

    private LocalDate parseDateOrToday(String date) {
        if (date == null || date.isBlank()) {
            return LocalDate.now();
        }
        try {
            return LocalDate.parse(date);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("date must be in yyyy-MM-dd format");
        }
    }

    private String formatDateTime(LocalDateTime dateTime) {
        return dateTime != null ? dateTime.toString() : null;
    }
}
