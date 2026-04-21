package com.plantcloud.monitoring.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plantcloud.device.entity.Device;
import com.plantcloud.device.mapper.DeviceMapper;
import com.plantcloud.monitoring.entity.HumidityData;
import com.plantcloud.monitoring.entity.LightData;
import com.plantcloud.monitoring.entity.TemperatureData;
import com.plantcloud.monitoring.mapper.HumidityDataMapper;
import com.plantcloud.monitoring.mapper.LightDataMapper;
import com.plantcloud.monitoring.mapper.TemperatureDataMapper;
import com.plantcloud.monitoring.service.MonitoringService;
import com.plantcloud.monitoring.vo.CurrentEnvironmentVO;
import com.plantcloud.monitoring.vo.DeviceStatusOverviewVO;
import com.plantcloud.strategy.entity.Strategy;
import com.plantcloud.strategy.entity.StrategyExecutionLog;
import com.plantcloud.strategy.mapper.StrategyExecutionLogMapper;
import com.plantcloud.strategy.mapper.StrategyMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class MonitoringServiceImpl implements MonitoringService {

    private static final String TYPE_CONDITION = "CONDITION";
    private static final String OPERATOR_LT = "LT";
    private static final String OPERATOR_GT = "GT";
    private static final String OPERATOR_EQ = "EQ";
    private static final String OPERATOR_LTE = "LTE";
    private static final String OPERATOR_GTE = "GTE";
    private static final String OPERATOR_BETWEEN = "BETWEEN";
    private static final String METRIC_TEMPERATURE = "TEMPERATURE";
    private static final String METRIC_HUMIDITY = "HUMIDITY";
    private static final String METRIC_LIGHT = "LIGHT";

    private final TemperatureDataMapper temperatureDataMapper;
    private final HumidityDataMapper humidityDataMapper;
    private final LightDataMapper lightDataMapper;
    private final DeviceMapper deviceMapper;
    private final StrategyMapper strategyMapper;
    private final StrategyExecutionLogMapper strategyExecutionLogMapper;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public CurrentEnvironmentVO getCurrentEnvironment(Long plantId) {
        TemperatureData temperatureData = temperatureDataMapper.selectOne(
                new LambdaQueryWrapper<TemperatureData>()
                        .eq(TemperatureData::getPlantId, plantId)
                        .orderByDesc(TemperatureData::getCollectedAt)
                        .last("limit 1")
        );
        HumidityData humidityData = humidityDataMapper.selectOne(
                new LambdaQueryWrapper<HumidityData>()
                        .eq(HumidityData::getPlantId, plantId)
                        .orderByDesc(HumidityData::getCollectedAt)
                        .last("limit 1")
        );
        LightData lightData = lightDataMapper.selectOne(
                new LambdaQueryWrapper<LightData>()
                        .eq(LightData::getPlantId, plantId)
                        .orderByDesc(LightData::getCollectedAt)
                        .last("limit 1")
        );

        BigDecimal temperature = temperatureData != null ? temperatureData.getTemperature() : null;
        BigDecimal humidity = humidityData != null ? humidityData.getHumidity() : null;
        BigDecimal lightLux = lightData != null ? lightData.getLightLux() : null;
        LocalDateTime collectedAt = resolveLatestTime(temperatureData, humidityData, lightData);

        evaluateConditionStrategies(plantId, temperature, humidity, lightLux, collectedAt);

        return CurrentEnvironmentVO.builder()
                .plantId(plantId)
                .temperature(temperature)
                .humidity(humidity)
                .lightLux(lightLux)
                .temperatureStatus(resolveTemperatureStatus(temperature))
                .humidityStatus(resolveHumidityStatus(humidity))
                .lightStatus(resolveLightStatus(lightLux))
                .collectedAt(collectedAt)
                .build();
    }

    @Override
    public DeviceStatusOverviewVO getDeviceStatus(Long plantId) {
        List<DeviceStatusOverviewVO.DeviceStatusVO> devices = deviceMapper.selectList(
                        new LambdaQueryWrapper<Device>()
                                .eq(Device::getPlantId, plantId)
                                .orderByAsc(Device::getId)
                ).stream()
                .map(device -> DeviceStatusOverviewVO.DeviceStatusVO.builder()
                        .deviceId(device.getId())
                        .deviceCode(device.getDeviceCode())
                        .deviceName(device.getDeviceName())
                        .deviceType(device.getDeviceType())
                        .onlineStatus(device.getOnlineStatus())
                        .currentStatus(device.getCurrentStatus())
                        .build())
                .toList();

        return DeviceStatusOverviewVO.builder()
                .plantId(plantId)
                .devices(devices)
                .build();
    }

    private String resolveTemperatureStatus(BigDecimal temperature) {
        if (temperature == null) {
            return "UNKNOWN";
        }
        if (temperature.compareTo(BigDecimal.valueOf(18)) < 0) {
            return "LOW";
        }
        if (temperature.compareTo(BigDecimal.valueOf(30)) > 0) {
            return "HIGH";
        }
        return "NORMAL";
    }

    private String resolveHumidityStatus(BigDecimal humidity) {
        if (humidity == null) {
            return "UNKNOWN";
        }
        if (humidity.compareTo(BigDecimal.valueOf(40)) < 0) {
            return "LOW";
        }
        if (humidity.compareTo(BigDecimal.valueOf(80)) > 0) {
            return "HIGH";
        }
        return "NORMAL";
    }

    private String resolveLightStatus(BigDecimal lightLux) {
        if (lightLux == null) {
            return "UNKNOWN";
        }
        if (lightLux.compareTo(BigDecimal.valueOf(300)) < 0) {
            return "LOW";
        }
        if (lightLux.compareTo(BigDecimal.valueOf(30000)) > 0) {
            return "HIGH";
        }
        return "NORMAL";
    }

    private void evaluateConditionStrategies(Long plantId,
                                             BigDecimal temperature,
                                             BigDecimal humidity,
                                             BigDecimal lightLux,
                                             LocalDateTime collectedAt) {
        List<Strategy> strategies = strategyMapper.selectByPlantIdAndFilters(plantId, true, TYPE_CONDITION);
        for (Strategy strategy : strategies) {
            if (!isWithinConfiguredTimeWindow(strategy)) {
                continue;
            }

            BigDecimal currentValue = resolveMetricValue(strategy.getMetricType(), temperature, humidity, lightLux);
            if (currentValue == null || !isConditionTriggered(strategy, currentValue)) {
                continue;
            }

            String payload = buildTriggerPayload(strategy, currentValue, collectedAt);
            StrategyExecutionLog latestLog = strategyExecutionLogMapper.selectLatestByStrategyId(strategy.getId());
            if (isDuplicateTrigger(latestLog, currentValue, payload)) {
                continue;
            }

            StrategyExecutionLog log = new StrategyExecutionLog();
            log.setStrategyId(strategy.getId());
            log.setPlantId(plantId);
            log.setTriggerSource("REALTIME_DATA");
            log.setTriggerMetricValue(currentValue);
            log.setTriggerPayload(payload);
            log.setExecutionResult("SUCCESS");
            log.setResultMessage(buildResultMessage(strategy, currentValue));
            log.setExecutedAt(LocalDateTime.now());
            strategyExecutionLogMapper.insert(log);
        }
    }

    private boolean isDuplicateTrigger(StrategyExecutionLog latestLog, BigDecimal currentValue, String payload) {
        if (latestLog == null) {
            return false;
        }
        if (latestLog.getTriggerMetricValue() != null
                && latestLog.getTriggerMetricValue().compareTo(currentValue) == 0) {
            return true;
        }
        return payload.equals(latestLog.getTriggerPayload());
    }

    private BigDecimal resolveMetricValue(String metricType,
                                          BigDecimal temperature,
                                          BigDecimal humidity,
                                          BigDecimal lightLux) {
        return switch (metricType) {
            case METRIC_TEMPERATURE -> temperature;
            case METRIC_HUMIDITY -> humidity;
            case METRIC_LIGHT -> lightLux;
            default -> null;
        };
    }

    private boolean isConditionTriggered(Strategy strategy, BigDecimal value) {
        return switch (strategy.getOperatorType()) {
            case OPERATOR_LT -> strategy.getThresholdMin() != null
                    && value.compareTo(strategy.getThresholdMin()) < 0;
            case OPERATOR_LTE -> strategy.getThresholdMin() != null
                    && value.compareTo(strategy.getThresholdMin()) <= 0;
            case OPERATOR_GT -> strategy.getThresholdMin() != null
                    && value.compareTo(strategy.getThresholdMin()) > 0;
            case OPERATOR_GTE -> strategy.getThresholdMin() != null
                    && value.compareTo(strategy.getThresholdMin()) >= 0;
            case OPERATOR_EQ -> strategy.getThresholdMin() != null
                    && value.compareTo(strategy.getThresholdMin()) == 0;
            case OPERATOR_BETWEEN -> strategy.getThresholdMin() != null
                    && strategy.getThresholdMax() != null
                    && (value.compareTo(strategy.getThresholdMin()) < 0
                    || value.compareTo(strategy.getThresholdMax()) > 0);
            default -> false;
        };
    }

    private boolean isWithinConfiguredTimeWindow(Strategy strategy) {
        Map<String, Object> config = parseConfig(strategy.getConfigJson());
        if (!Boolean.TRUE.equals(config.get("timeLimitEnabled"))) {
            return true;
        }
        Object startValue = config.get("startTime");
        Object endValue = config.get("endTime");
        if (startValue == null || endValue == null) {
            return true;
        }
        try {
            LocalTime now = LocalTime.now();
            LocalTime start = LocalTime.parse(String.valueOf(startValue));
            LocalTime end = LocalTime.parse(String.valueOf(endValue));
            if (start.equals(end)) {
                return true;
            }
            if (start.isBefore(end)) {
                return !now.isBefore(start) && !now.isAfter(end);
            }
            return !now.isBefore(start) || !now.isAfter(end);
        } catch (DateTimeParseException ex) {
            return true;
        }
    }

    private Map<String, Object> parseConfig(String configJson) {
        if (configJson == null || configJson.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(configJson, new TypeReference<Map<String, Object>>() {
            });
        } catch (JsonProcessingException ex) {
            return Map.of();
        }
    }

    private String buildTriggerPayload(Strategy strategy, BigDecimal currentValue, LocalDateTime collectedAt) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("strategyId", strategy.getId());
        payload.put("strategyName", strategy.getStrategyName());
        payload.put("metricType", strategy.getMetricType());
        payload.put("operatorType", strategy.getOperatorType());
        payload.put("thresholdMin", strategy.getThresholdMin());
        payload.put("thresholdMax", strategy.getThresholdMax());
        payload.put("actionType", strategy.getActionType());
        payload.put("actionValue", strategy.getActionValue());
        payload.put("value", currentValue);
        payload.put("collectedAt", collectedAt);
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            return payload.toString();
        }
    }

    private String buildResultMessage(Strategy strategy, BigDecimal currentValue) {
        return "Strategy triggered: " + strategy.getStrategyName()
                + ", metric=" + strategy.getMetricType()
                + ", current=" + currentValue
                + ", condition=" + strategy.getOperatorType()
                + " " + strategy.getThresholdMin()
                + (strategy.getThresholdMax() == null ? "" : "-" + strategy.getThresholdMax())
                + ", action=" + strategy.getActionType();
    }

    private LocalDateTime resolveLatestTime(TemperatureData temperatureData,
                                            HumidityData humidityData,
                                            LightData lightData) {
        LocalDateTime latest = null;
        if (temperatureData != null && temperatureData.getCollectedAt() != null) {
            latest = temperatureData.getCollectedAt();
        }
        if (humidityData != null && humidityData.getCollectedAt() != null
                && (latest == null || humidityData.getCollectedAt().isAfter(latest))) {
            latest = humidityData.getCollectedAt();
        }
        if (lightData != null && lightData.getCollectedAt() != null
                && (latest == null || lightData.getCollectedAt().isAfter(latest))) {
            latest = lightData.getCollectedAt();
        }
        return latest;
    }
}
