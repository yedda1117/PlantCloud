package com.plantcloud.alert.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.plantcloud.alert.entity.AlertLog;
import com.plantcloud.alert.entity.AlertSeverityEnum;
import com.plantcloud.alert.entity.AlertStatusEnum;
import com.plantcloud.alert.entity.AlertTypeEnum;
import com.plantcloud.alert.mapper.AlertLogMapper;
import com.plantcloud.alert.service.AlertService;
import com.plantcloud.alert.vo.AlertLogVO;
import com.plantcloud.alert.vo.AlertVO;
import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.common.result.PageResult;
import com.plantcloud.system.exception.BizException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AlertServiceImpl implements AlertService {

    private static final String SMOKE_GAS_METRIC_NAME = "smoke_gas_ppm";
    private static final long MAX_PAGE_SIZE = 100L;
    private static final Map<String, String> LOCALIZED_TITLES = Map.ofEntries(
            Map.entry("Smoke or gas fluctuation", "\u70df\u96fe/\u6c14\u4f53\u6ce2\u52a8\u63d0\u9192"),
            Map.entry("Air quality fluctuation", "\u7a7a\u6c14\u8d28\u91cf\u6ce2\u52a8\u63d0\u9192"),
            Map.entry("Strong smoke alert", "\u70df\u96fe/\u6c14\u4f53\u4e25\u91cd\u544a\u8b66"),
            Map.entry("Smoke alert resolved", "\u70df\u96fe/\u6c14\u4f53\u544a\u8b66\u5df2\u6062\u590d"),
            Map.entry("Air quality warning", "\u7a7a\u6c14\u8d28\u91cf\u544a\u8b66"),
            Map.entry("Air quality monitoring", "\u7a7a\u6c14\u8d28\u91cf\u89c2\u5bdf\u63d0\u9192"),
            Map.entry("Air quality spike", "\u7a7a\u6c14\u8d28\u91cf\u77ed\u65f6\u5347\u9ad8"),
            Map.entry("Ventilation reminder", "\u901a\u98ce\u63d0\u9192")
    );
    private static final Map<String, String> LOCALIZED_CONTENTS = Map.ofEntries(
            Map.entry("A mild smoke or gas fluctuation was detected and later recovered.",
                    "\u68c0\u6d4b\u5230\u8f7b\u5fae\u70df\u96fe/\u6c14\u4f53\u6ce2\u52a8\uff0c\u540e\u7eed\u5df2\u6062\u590d\u6b63\u5e38\u3002"),
            Map.entry("Air quality rose above baseline for a short time.",
                    "\u7a7a\u6c14\u8d28\u91cf\u77ed\u65f6\u9ad8\u4e8e\u57fa\u51c6\u503c\uff0c\u8bf7\u7559\u610f\u73af\u5883\u53d8\u5316\u3002"),
            Map.entry("A strong smoke or gas anomaly was detected.",
                    "\u68c0\u6d4b\u5230\u8f83\u5f3a\u70df\u96fe/\u6c14\u4f53\u5f02\u5e38\uff0c\u8bf7\u53ca\u65f6\u68c0\u67e5\u73af\u5883\u4e0e\u8bbe\u5907\u3002"),
            Map.entry("Air quality increased briefly before returning to normal.",
                    "\u7a7a\u6c14\u8d28\u91cf\u77ed\u6682\u5347\u9ad8\u540e\u5df2\u6062\u590d\u6b63\u5e38\uff0c\u5efa\u8bae\u4fdd\u6301\u901a\u98ce\u89c2\u5bdf\u3002"),
            Map.entry("High smoke or gas concentration was detected and then resolved.",
                    "\u68c0\u6d4b\u5230\u8f83\u9ad8\u70df\u96fe/\u6c14\u4f53\u6d53\u5ea6\uff0c\u540e\u7eed\u5df2\u6062\u590d\u6b63\u5e38\u3002"),
            Map.entry("Air quality remains slightly elevated and should be monitored.",
                    "\u7a7a\u6c14\u8d28\u91cf\u4ecd\u7565\u9ad8\uff0c\u5efa\u8bae\u6301\u7eed\u89c2\u5bdf\u5e76\u68c0\u67e5\u901a\u98ce\u60c5\u51b5\u3002"),
            Map.entry("Air quality is still fluctuating and needs observation.",
                    "\u7a7a\u6c14\u8d28\u91cf\u4ecd\u5728\u6ce2\u52a8\uff0c\u9700\u8981\u7ee7\u7eed\u89c2\u5bdf\u3002"),
            Map.entry("Air quality was temporarily elevated and then recovered.",
                    "\u7a7a\u6c14\u8d28\u91cf\u66fe\u77ed\u65f6\u5347\u9ad8\uff0c\u540e\u7eed\u5df2\u6062\u590d\u6b63\u5e38\u3002")
    );

    private final AlertLogMapper alertLogMapper;

    @Override
    public List<AlertVO> listAlerts(String status) {
        String normalizedStatus = normalizeQueryStatus(status);
        return alertLogMapper.selectList(buildBaseQuery(normalizedStatus, null, null, null, null))
                .stream()
                .map(this::toAlertVO)
                .toList();
    }

    @Override
    public Optional<BigDecimal> findFirstUnresolvedSmokeGasPpmForPlant(Long plantId) {
        if (plantId == null) {
            return Optional.empty();
        }
        List<AlertLog> rows = alertLogMapper.selectList(
                new LambdaQueryWrapper<AlertLog>()
                        .eq(AlertLog::getPlantId, plantId)
                        .eq(AlertLog::getStatus, AlertStatusEnum.UNRESOLVED.getCode())
                        .orderByDesc(AlertLog::getCreatedAt));
        for (AlertLog row : rows) {
            if (SMOKE_GAS_METRIC_NAME.equals(row.getMetricName()) && row.getMetricValue() != null) {
                return Optional.of(row.getMetricValue());
            }
        }
        return Optional.empty();
    }

    @Override
    public PageResult<AlertLogVO> getAlertLogs(String alertType,
                                               String status,
                                               Long deviceId,
                                               LocalDateTime startTime,
                                               LocalDateTime endTime,
                                               Long current,
                                               Long pageSize) {
        validateTimeRange(startTime, endTime);
        String normalizedStatus = normalizeQueryStatus(status);
        String normalizedAlertType = normalizeAlertType(alertType);
        long currentPage = current == null ? 1L : current;
        long size = pageSize == null ? 10L : Math.min(pageSize, MAX_PAGE_SIZE);
        LambdaQueryWrapper<AlertLog> query = buildBaseQuery(normalizedStatus, normalizedAlertType, deviceId, startTime, endTime);

        if (currentPage == 1L && size == 1L) {
            List<AlertLog> latestOnly = alertLogMapper.selectList(query.last("limit 1"));
            return PageResult.<AlertLogVO>builder()
                    .current(1L)
                    .pageSize(1L)
                    .total((long) latestOnly.size())
                    .records(latestOnly.stream().map(this::toAlertLogVO).toList())
                    .build();
        }

        Page<AlertLog> page = new Page<>(currentPage, size);
        Page<AlertLog> result = alertLogMapper.selectPage(page, query);

        return PageResult.<AlertLogVO>builder()
                .current(result.getCurrent())
                .pageSize(result.getSize())
                .total(result.getTotal())
                .records(result.getRecords().stream().map(this::toAlertLogVO).toList())
                .build();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AlertLogVO resolveAlert(Long alertId, Long resolvedBy) {
        AlertLog alertLog = requireAlert(alertId);
        if (AlertStatusEnum.RESOLVED.getCode().equals(alertLog.getStatus())) {
            return toAlertLogVO(alertLog);
        }
        if (!AlertStatusEnum.UNRESOLVED.getCode().equals(alertLog.getStatus())) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "Only UNRESOLVED alerts can be resolved");
        }
        alertLog.setStatus(AlertStatusEnum.RESOLVED.getCode());
        alertLog.setResolvedBy(resolvedBy);
        alertLog.setResolvedAt(LocalDateTime.now());
        alertLogMapper.updateById(alertLog);
        return toAlertLogVO(requireAlert(alertId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AlertLogVO createAlert(AlertLog alertLog) {
        if (alertLog == null) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "alertLog cannot be null");
        }
        if (alertLog.getPlantId() == null) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "plantId cannot be null");
        }
        if (!StringUtils.hasText(alertLog.getTitle())) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "title cannot be blank");
        }

        alertLog.setAlertType(normalizeAlertType(alertLog.getAlertType()));
        alertLog.setSeverity(normalizeSeverity(alertLog.getSeverity()));
        alertLog.setStatus(normalizeCreateStatus(alertLog.getStatus()));
        if (alertLog.getCreatedAt() == null) {
            alertLog.setCreatedAt(LocalDateTime.now());
        }

        alertLogMapper.insert(alertLog);

        // Reserve a hook for future SSE push after alert persistence.
        return toAlertLogVO(requireAlert(alertLog.getId()));
    }

    private LambdaQueryWrapper<AlertLog> buildBaseQuery(String status,
                                                        String alertType,
                                                        Long deviceId,
                                                        LocalDateTime startTime,
                                                        LocalDateTime endTime) {
        LambdaQueryWrapper<AlertLog> queryWrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(status)) {
            queryWrapper.eq(AlertLog::getStatus, status);
        }
        if (StringUtils.hasText(alertType)) {
            queryWrapper.eq(AlertLog::getAlertType, alertType);
        }
        if (deviceId != null) {
            queryWrapper.eq(AlertLog::getDeviceId, deviceId);
        }
        if (startTime != null) {
            queryWrapper.ge(AlertLog::getCreatedAt, startTime);
        }
        if (endTime != null) {
            queryWrapper.le(AlertLog::getCreatedAt, endTime);
        }
        queryWrapper.orderByDesc(AlertLog::getCreatedAt);
        return queryWrapper;
    }

    private AlertLog requireAlert(Long alertId) {
        AlertLog alertLog = alertLogMapper.selectById(alertId);
        if (alertLog == null) {
            throw new BizException(ResultCode.NOT_FOUND.getCode(), "Alert not found");
        }
        return alertLog;
    }

    private void validateTimeRange(LocalDateTime startTime, LocalDateTime endTime) {
        if (startTime != null && endTime != null && startTime.isAfter(endTime)) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "start_time must be before or equal to end_time");
        }
    }

    private String normalizeQueryStatus(String status) {
        if (!StringUtils.hasText(status)) {
            return null;
        }
        AlertStatusEnum alertStatusEnum = AlertStatusEnum.fromCode(status);
        if (!alertStatusEnum.isQueryable()) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "status only supports UNRESOLVED or RESOLVED");
        }
        return alertStatusEnum.getCode();
    }

    private String normalizeCreateStatus(String status) {
        if (!StringUtils.hasText(status)) {
            return AlertStatusEnum.UNRESOLVED.getCode();
        }
        AlertStatusEnum alertStatusEnum = AlertStatusEnum.fromCode(status);
        if (!alertStatusEnum.isQueryable()) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "createAlert only supports UNRESOLVED or RESOLVED");
        }
        return alertStatusEnum.getCode();
    }

    private String normalizeAlertType(String alertType) {
        if (!StringUtils.hasText(alertType)) {
            return null;
        }
        return AlertTypeEnum.fromCode(alertType).getCode();
    }

    private String normalizeSeverity(String severity) {
        if (!StringUtils.hasText(severity)) {
            return AlertSeverityEnum.MEDIUM.getCode();
        }
        return AlertSeverityEnum.fromCode(severity).getCode();
    }

    private AlertVO toAlertVO(AlertLog alertLog) {
        return AlertVO.builder()
                .id(alertLog.getId())
                .plantId(alertLog.getPlantId())
                .deviceId(alertLog.getDeviceId())
                .alertType(alertLog.getAlertType())
                .severity(alertLog.getSeverity())
                .title(localizeTitle(alertLog))
                .content(localizeContent(alertLog))
                .metricName(alertLog.getMetricName())
                .metricValue(alertLog.getMetricValue())
                .thresholdValue(alertLog.getThresholdValue())
                .status(alertLog.getStatus())
                .resolvedBy(alertLog.getResolvedBy())
                .resolvedAt(alertLog.getResolvedAt())
                .extraData(alertLog.getExtraData())
                .createdAt(alertLog.getCreatedAt())
                .build();
    }

    private AlertLogVO toAlertLogVO(AlertLog alertLog) {
        return AlertLogVO.builder()
                .id(alertLog.getId())
                .plantId(alertLog.getPlantId())
                .deviceId(alertLog.getDeviceId())
                .alertType(alertLog.getAlertType())
                .severity(alertLog.getSeverity())
                .title(localizeTitle(alertLog))
                .content(localizeContent(alertLog))
                .metricName(alertLog.getMetricName())
                .metricValue(alertLog.getMetricValue())
                .thresholdValue(alertLog.getThresholdValue())
                .status(alertLog.getStatus())
                .resolvedBy(alertLog.getResolvedBy())
                .resolvedAt(alertLog.getResolvedAt())
                .extraData(alertLog.getExtraData())
                .createdAt(alertLog.getCreatedAt())
                .build();
    }

    private String localizeTitle(AlertLog alertLog) {
        String title = alertLog.getTitle();
        if (StringUtils.hasText(title) && LOCALIZED_TITLES.containsKey(title)) {
            return LOCALIZED_TITLES.get(title);
        }
        return title;
    }

    private String localizeContent(AlertLog alertLog) {
        String content = alertLog.getContent();
        if (StringUtils.hasText(content) && LOCALIZED_CONTENTS.containsKey(content)) {
            return LOCALIZED_CONTENTS.get(content);
        }
        return content;
    }
}
