package com.plantcloud.visualization.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.plantcloud.monitoring.entity.HumidityData;
import com.plantcloud.monitoring.entity.LightData;
import com.plantcloud.monitoring.entity.TemperatureData;
import com.plantcloud.monitoring.mapper.HumidityDataMapper;
import com.plantcloud.monitoring.mapper.LightDataMapper;
import com.plantcloud.monitoring.mapper.TemperatureDataMapper;
import com.plantcloud.plant.entity.Plant;
import com.plantcloud.plant.mapper.PlantMapper;
import com.plantcloud.visualization.service.VisualizationService;
import com.plantcloud.visualization.vo.CalendarDayVO;
import com.plantcloud.visualization.vo.CalendarDetailVO;
import com.plantcloud.visualization.vo.EnvironmentHistoryVO;
import com.plantcloud.visualization.vo.StrategyExecutionLogVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
public class VisualizationServiceImpl implements VisualizationService {

    private static final Long DEFAULT_PLANT_ID = 1L;
    private static final DateTimeFormatter OUTPUT_TIME_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final TemperatureDataMapper temperatureDataMapper;
    private final HumidityDataMapper humidityDataMapper;
    private final LightDataMapper lightDataMapper;
    private final PlantMapper plantMapper;

    @Override
    public EnvironmentHistoryVO getHistory(String startTime, String endTime, String granularity, String metrics, Long plantId, String plantType) {
        LocalDateTime start = parseDateTime(startTime);
        LocalDateTime end = parseDateTime(endTime);
        if (end.isBefore(start)) {
            throw new IllegalArgumentException("end_time must be later than start_time");
        }

        String normalizedGranularity = normalizeGranularity(granularity);
        Set<String> selectedMetrics = parseMetrics(metrics);
        Plant targetPlant = resolvePlant(plantId, plantType);

        List<EnvironmentHistoryVO.HistoryPointVO> temperatureSeries = selectedMetrics.contains("temperature")
                ? aggregateTemperatureHistory(targetPlant.getId(), start, end, normalizedGranularity)
                : Collections.emptyList();
        List<EnvironmentHistoryVO.HistoryPointVO> humiditySeries = selectedMetrics.contains("humidity")
                ? aggregateHumidityHistory(targetPlant.getId(), start, end, normalizedGranularity)
                : Collections.emptyList();
        List<EnvironmentHistoryVO.HistoryPointVO> lightSeries = selectedMetrics.contains("light")
                ? aggregateLightHistory(targetPlant.getId(), start, end, normalizedGranularity)
                : Collections.emptyList();

        return EnvironmentHistoryVO.builder()
                .plantId(targetPlant.getId())
                .plantType(targetPlant.getSpecies())
                .startTime(start.toString())
                .endTime(end.toString())
                .granularity(normalizedGranularity)
                .metrics(new ArrayList<>(selectedMetrics))
                .temperature(temperatureSeries)
                .humidity(humiditySeries)
                .light(lightSeries)
                .build();
    }

    @Override
    public List<CalendarDayVO> getCalendar(Long plantId, String month) {
        return Collections.emptyList();
    }

    @Override
    public CalendarDetailVO getCalendarDetail(Long plantId, String date) {
        return CalendarDetailVO.builder().date(date).build();
    }

    @Override
    public List<StrategyExecutionLogVO> getStrategyLogs(Long plantId) {
        return Collections.emptyList();
    }

    private List<EnvironmentHistoryVO.HistoryPointVO> aggregateTemperatureHistory(Long plantId,
                                                                                  LocalDateTime start,
                                                                                  LocalDateTime end,
                                                                                  String granularity) {
        List<TemperatureData> records = temperatureDataMapper.selectList(
                new LambdaQueryWrapper<TemperatureData>()
                        .eq(TemperatureData::getPlantId, plantId)
                        .between(TemperatureData::getCollectedAt, start, end)
                        .orderByAsc(TemperatureData::getCollectedAt)
        );
        return aggregateSeries(records, TemperatureData::getCollectedAt, TemperatureData::getTemperature, granularity);
    }

    private List<EnvironmentHistoryVO.HistoryPointVO> aggregateHumidityHistory(Long plantId,
                                                                               LocalDateTime start,
                                                                               LocalDateTime end,
                                                                               String granularity) {
        List<HumidityData> records = humidityDataMapper.selectList(
                new LambdaQueryWrapper<HumidityData>()
                        .eq(HumidityData::getPlantId, plantId)
                        .between(HumidityData::getCollectedAt, start, end)
                        .orderByAsc(HumidityData::getCollectedAt)
        );
        return aggregateSeries(records, HumidityData::getCollectedAt, HumidityData::getHumidity, granularity);
    }

    private List<EnvironmentHistoryVO.HistoryPointVO> aggregateLightHistory(Long plantId,
                                                                            LocalDateTime start,
                                                                            LocalDateTime end,
                                                                            String granularity) {
        List<LightData> records = lightDataMapper.selectList(
                new LambdaQueryWrapper<LightData>()
                        .eq(LightData::getPlantId, plantId)
                        .between(LightData::getCollectedAt, start, end)
                        .orderByAsc(LightData::getCollectedAt)
        );
        return aggregateSeries(records, LightData::getCollectedAt, LightData::getLightLux, granularity);
    }

    private Plant resolvePlant(Long plantId, String plantType) {
        if (plantId != null) {
            Plant plant = plantMapper.selectById(plantId);
            if (plant == null) {
                throw new IllegalArgumentException("Plant not found, plantId=" + plantId);
            }
            return plant;
        }

        if (plantType == null || plantType.isBlank()) {
            Plant plant = plantMapper.selectById(DEFAULT_PLANT_ID);
            if (plant == null) {
                throw new IllegalArgumentException("Default plant not found, plantId=" + DEFAULT_PLANT_ID);
            }
            return plant;
        }

        Plant plant = plantMapper.selectOne(
                new LambdaQueryWrapper<Plant>()
                        .eq(Plant::getSpecies, plantType)
                        .orderByAsc(Plant::getId)
                        .last("limit 1")
        );
        if (plant == null) {
            throw new IllegalArgumentException("Plant type not found: " + plantType);
        }
        return plant;
    }

    private <T> List<EnvironmentHistoryVO.HistoryPointVO> aggregateSeries(List<T> records,
                                                                          Function<T, LocalDateTime> timeExtractor,
                                                                          Function<T, BigDecimal> valueExtractor,
                                                                          String granularity) {
        Map<LocalDateTime, AggregateBucket> buckets = new LinkedHashMap<>();
        for (T record : records) {
            LocalDateTime bucketTime = truncate(timeExtractor.apply(record), granularity);
            AggregateBucket bucket = buckets.computeIfAbsent(bucketTime, ignored -> new AggregateBucket());
            bucket.add(valueExtractor.apply(record));
        }

        return buckets.entrySet().stream()
                .sorted(Map.Entry.comparingByKey(Comparator.naturalOrder()))
                .map(entry -> EnvironmentHistoryVO.HistoryPointVO.builder()
                        .time(entry.getKey().format(OUTPUT_TIME_FORMATTER))
                        .value(entry.getValue().average())
                        .build())
                .toList();
    }

    private LocalDateTime truncate(LocalDateTime time, String granularity) {
        return switch (granularity) {
            case "minute" -> time.truncatedTo(ChronoUnit.MINUTES);
            case "day" -> time.toLocalDate().atStartOfDay();
            default -> time.truncatedTo(ChronoUnit.HOURS);
        };
    }

    private String normalizeGranularity(String granularity) {
        if (granularity == null || granularity.isBlank()) {
            return "hour";
        }
        String normalized = granularity.trim().toLowerCase(Locale.ROOT);
        if (!List.of("minute", "hour", "day").contains(normalized)) {
            throw new IllegalArgumentException("granularity must be one of minute, hour, day");
        }
        return normalized;
    }

    private Set<String> parseMetrics(String metrics) {
        if (metrics == null || metrics.isBlank()) {
            return new LinkedHashSet<>(List.of("temperature", "humidity", "light"));
        }

        Set<String> parsed = new LinkedHashSet<>();
        Arrays.stream(metrics.split(","))
                .map(String::trim)
                .map(metric -> metric.toLowerCase(Locale.ROOT))
                .forEach(metric -> {
                    if (!List.of("temperature", "humidity", "light").contains(metric)) {
                        throw new IllegalArgumentException("Unsupported metric: " + metric);
                    }
                    parsed.add(metric);
                });
        return parsed;
    }

    private LocalDateTime parseDateTime(String value) {
        try {
            return OffsetDateTime.parse(value).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
        } catch (Exception ignored) {
            return LocalDateTime.parse(value);
        }
    }

    private static class AggregateBucket {
        private BigDecimal total = BigDecimal.ZERO;
        private int count = 0;

        void add(BigDecimal value) {
            if (value == null) {
                return;
            }
            total = total.add(value);
            count++;
        }

        double average() {
            if (count == 0) {
                return 0D;
            }
            return total.divide(BigDecimal.valueOf(count), 2, java.math.RoundingMode.HALF_UP).doubleValue();
        }
    }
}
