package com.plantcloud.mqtt.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.plantcloud.device.entity.Device;
import com.plantcloud.device.mapper.DeviceMapper;
import com.plantcloud.gps.entity.GpsLocationLog;
import com.plantcloud.gps.mapper.GpsLocationLogMapper;
import com.plantcloud.mqtt.listener.GpsLocationMessage;
import com.plantcloud.mqtt.service.GpsLocationMessageService;
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
public class GpsLocationMessageServiceImpl implements GpsLocationMessageService {

    private static final ZoneId MQTT_EVENT_ZONE = ZoneId.of("Asia/Shanghai");
    private static final long EPOCH_MILLI_THRESHOLD = 100_000_000_000L;

    private final DeviceMapper deviceMapper;
    private final GpsLocationLogMapper gpsLocationLogMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void handleGpsLocation(Long deviceId, GpsLocationMessage message, String rawPayload) {
        // 1. 设备校验
        Device device = deviceMapper.selectById(deviceId);
        if (device == null) {
            log.error("设备不存在,无法保存GPS数据.deviceId={}", deviceId);
            throw new IllegalArgumentException("Device not found, deviceId=" + deviceId);
        }

        // 2. 植物绑定校验
        Long targetPlantId = message.getPlantId();
        Double longitude = message.getLongitude();
        Double latitude  = message.getLatitude();

        if (longitude == null || latitude == null) {
            log.warn("GPS location message has null coordinates, skipping. deviceId={}, payload={}",
                    deviceId, rawPayload);
            return;
        }

        // 3. 位置去重：与最新一条记录经纬度相同则跳过
        if (shouldIgnoreLocation(deviceId, longitude, latitude)) {
            log.info("GPS location unchanged, skipping insert. deviceId={}, plantId={}, longitude={}, latitude={}",
                    deviceId, device.getPlantId(), longitude, latitude);
            return;
        }

        // 4. 插入新记录
        LocalDateTime eventTime = resolveEventTime(message.getTimestamp());

        GpsLocationLog locationLog = new GpsLocationLog();
        locationLog.setDeviceId(deviceId);
        locationLog.setPlantId(device.getPlantId());
        locationLog.setLongitude(longitude);
        locationLog.setLatitude(latitude);
        locationLog.setCreatedAt(eventTime);
        gpsLocationLogMapper.insert(locationLog);

        log.info("Inserted GPS location log successfully. logId={}, deviceId={}, plantId={}, longitude={}, latitude={}, createdAt={}",
                locationLog.getId(), deviceId, device.getPlantId(), longitude, latitude, eventTime);
    }

    /**
     * 如果最新一条记录的经纬度与当前上报值完全一致，则忽略本次插入。
     */
    private boolean shouldIgnoreLocation(Long deviceId, Double longitude, Double latitude) {
        GpsLocationLog latest = gpsLocationLogMapper.selectOne(
                new LambdaQueryWrapper<GpsLocationLog>()
                        .eq(GpsLocationLog::getDeviceId, deviceId)
                        .orderByDesc(GpsLocationLog::getCreatedAt)
                        .orderByDesc(GpsLocationLog::getId)
                        .last("limit 1")
        );

        if (latest == null) {
            return false;
        }

        return longitude.equals(latest.getLongitude()) && latitude.equals(latest.getLatitude());
    }

    /**
     * 解析时间戳，自动识别秒级（10位）和毫秒级（13位）。
     * 若时间戳为空或无效，则回退到当前时间。
     */
    private LocalDateTime resolveEventTime(Long timestamp) {
        if (timestamp == null || timestamp <= 0) {
            LocalDateTime now = LocalDateTime.now(MQTT_EVENT_ZONE);
            log.warn("GPS MQTT timestamp missing or invalid, using current time. timestamp={}, fallbackTime={}",
                    timestamp, now);
            return now;
        }

        Instant instant = timestamp >= EPOCH_MILLI_THRESHOLD
                ? Instant.ofEpochMilli(timestamp)
                : Instant.ofEpochSecond(timestamp);
        LocalDateTime eventTime = LocalDateTime.ofInstant(instant, MQTT_EVENT_ZONE);
        log.info("Resolved GPS event time. rawTimestamp={}, resolvedEventTime={}, zone={}",
                timestamp, eventTime, MQTT_EVENT_ZONE);
        return eventTime;
    }
}
