package com.plantcloud.calendar.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.plantcloud.calendar.dto.CalendarLogUpdateDTO;
import com.plantcloud.calendar.service.CalendarService;
import com.plantcloud.calendar.vo.CalendarDayDetailVO;
import com.plantcloud.calendar.vo.CalendarSummaryVO;
import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.monitoring.entity.HumidityData;
import com.plantcloud.monitoring.entity.LightData;
import com.plantcloud.monitoring.entity.TemperatureData;
import com.plantcloud.monitoring.mapper.HumidityDataMapper;
import com.plantcloud.monitoring.mapper.LightDataMapper;
import com.plantcloud.monitoring.mapper.TemperatureDataMapper;
import com.plantcloud.photo.entity.MilestoneEnum;
import com.plantcloud.photo.entity.PlantLog;
import com.plantcloud.photo.mapper.PlantLogMapper;
import com.plantcloud.photo.service.impl.PhotoPathResolver;
import com.plantcloud.plant.entity.Plant;
import com.plantcloud.plant.mapper.PlantMapper;
import com.plantcloud.system.exception.BizException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CalendarServiceImpl implements CalendarService {

    private final PlantMapper plantMapper;
    private final PlantLogMapper plantLogMapper;
    private final TemperatureDataMapper temperatureDataMapper;
    private final HumidityDataMapper humidityDataMapper;
    private final LightDataMapper lightDataMapper;
    private final PhotoPathResolver photoPathResolver;

    @Override
    public List<CalendarSummaryVO> getMonthView(Long plantId, Integer year, Integer month) {
        requirePlant(plantId);
        LocalDate startDate = LocalDate.of(year, month, 1);
        LocalDate endDate = startDate.withDayOfMonth(startDate.lengthOfMonth());

        return plantLogMapper.selectList(new LambdaQueryWrapper<PlantLog>()
                        .eq(PlantLog::getPlantId, plantId)
                        .between(PlantLog::getLogDate, startDate, endDate)
                        .orderByAsc(PlantLog::getLogDate))
                .stream()
                .map(this::toCalendarSummaryVO)
                .toList();
    }

    @Override
    public CalendarDayDetailVO getDayDetail(Long plantId, LocalDate date) {
        requirePlant(plantId);
        PlantLog plantLog = findPlantLog(plantId, date);
        DailyEnvironmentSummary summary = buildEnvironmentSummary(plantId, date);
        if (plantLog == null && summary.isEmpty()) {
            throw new BizException(ResultCode.NOT_FOUND.getCode(), "No calendar data found");
        }
        return toCalendarDayDetailVO(plantId, date, plantLog, summary);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CalendarDayDetailVO updateDayLog(Long plantId, LocalDate date, CalendarLogUpdateDTO request) {
        requirePlant(plantId);
        if (request == null) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "request body cannot be null");
        }
        if (!request.isNoteProvided() && !request.isMilestoneProvided()) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "note or milestone is required");
        }

        PlantLog plantLog = findPlantLog(plantId, date);
        if (plantLog == null) {
            plantLog = new PlantLog();
            plantLog.setPlantId(plantId);
            plantLog.setLogDate(date);
        }
        if (request.isNoteProvided()) {
            plantLog.setNote(request.getNote());
        }
        if (request.isMilestoneProvided()) {
            plantLog.setMilestone(MilestoneEnum.normalize(request.getMilestone()));
        }
        savePlantLog(plantLog, request);
        return getDayDetail(plantId, date);
    }

    private Plant requirePlant(Long plantId) {
        Plant plant = plantMapper.selectById(plantId);
        if (plant == null) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "plant_id is invalid");
        }
        return plant;
    }

    private PlantLog findPlantLog(Long plantId, LocalDate date) {
        return plantLogMapper.selectOne(new LambdaQueryWrapper<PlantLog>()
                .eq(PlantLog::getPlantId, plantId)
                .eq(PlantLog::getLogDate, date)
                .last("limit 1"));
    }

    private void savePlantLog(PlantLog plantLog, CalendarLogUpdateDTO request) {
        if (plantLog.getId() == null) {
            plantLogMapper.insert(plantLog);
            return;
        }
        LambdaUpdateWrapper<PlantLog> updateWrapper = new LambdaUpdateWrapper<PlantLog>()
                .eq(PlantLog::getId, plantLog.getId());
        if (request.isNoteProvided()) {
            updateWrapper.set(PlantLog::getNote, plantLog.getNote());
        }
        if (request.isMilestoneProvided()) {
            updateWrapper.set(PlantLog::getMilestone, plantLog.getMilestone());
        }
        plantLogMapper.update(null, updateWrapper);
    }

    private DailyEnvironmentSummary buildEnvironmentSummary(Long plantId, LocalDate date) {
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end = date.plusDays(1).atStartOfDay();

        BigDecimal temperature = average(temperatureDataMapper.selectList(new LambdaQueryWrapper<TemperatureData>()
                .eq(TemperatureData::getPlantId, plantId)
                .ge(TemperatureData::getCollectedAt, start)
                .lt(TemperatureData::getCollectedAt, end)), TemperatureData::getTemperature);

        BigDecimal humidity = average(humidityDataMapper.selectList(new LambdaQueryWrapper<HumidityData>()
                .eq(HumidityData::getPlantId, plantId)
                .ge(HumidityData::getCollectedAt, start)
                .lt(HumidityData::getCollectedAt, end)), HumidityData::getHumidity);

        BigDecimal light = average(lightDataMapper.selectList(new LambdaQueryWrapper<LightData>()
                .eq(LightData::getPlantId, plantId)
                .ge(LightData::getCollectedAt, start)
                .lt(LightData::getCollectedAt, end)), LightData::getLightLux);

        return new DailyEnvironmentSummary(temperature, humidity, light);
    }

    private <T> BigDecimal average(List<T> records, java.util.function.Function<T, BigDecimal> extractor) {
        BigDecimal sum = BigDecimal.ZERO;
        int count = 0;
        for (T record : records) {
            BigDecimal value = extractor.apply(record);
            if (value == null) {
                continue;
            }
            sum = sum.add(value);
            count++;
        }
        if (count == 0) {
            return null;
        }
        return sum.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
    }

    private CalendarSummaryVO toCalendarSummaryVO(PlantLog plantLog) {
        boolean hasPhoto = StringUtils.hasText(plantLog.getPhotoUrl()) || StringUtils.hasText(plantLog.getOriginPhotoUrl());
        String thumbnailUrl = photoPathResolver.normalizeForResponse(
                StringUtils.hasText(plantLog.getPhotoUrl()) ? plantLog.getPhotoUrl() : plantLog.getOriginPhotoUrl());
        return CalendarSummaryVO.builder()
                .date(plantLog.getLogDate())
                .hasPhoto(hasPhoto)
                .thumbnailUrl(hasPhoto ? thumbnailUrl : null)
                .milestone(plantLog.getMilestone())
                .build();
    }

    private CalendarDayDetailVO toCalendarDayDetailVO(Long plantId,
                                                      LocalDate date,
                                                      PlantLog plantLog,
                                                      DailyEnvironmentSummary summary) {
        boolean hasPhoto = plantLog != null
                && (StringUtils.hasText(plantLog.getPhotoUrl()) || StringUtils.hasText(plantLog.getOriginPhotoUrl()));
        return CalendarDayDetailVO.builder()
                .plantId(plantId)
                .date(date)
                .photoUrl(plantLog == null ? null : photoPathResolver.normalizeForResponse(plantLog.getPhotoUrl()))
                .originPhotoUrl(plantLog == null ? null : photoPathResolver.normalizeForResponse(plantLog.getOriginPhotoUrl()))
                .note(plantLog == null ? null : plantLog.getNote())
                .milestone(plantLog == null ? null : plantLog.getMilestone())
                .temperature(summary.temperature())
                .humidity(summary.humidity())
                .light(summary.light())
                .hasPhoto(hasPhoto)
                .build();
    }

    private record DailyEnvironmentSummary(BigDecimal temperature, BigDecimal humidity, BigDecimal light) {
        private boolean isEmpty() {
            return temperature == null && humidity == null && light == null;
        }
    }
}
