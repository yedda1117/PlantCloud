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

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AlertServiceImpl implements AlertService {

    private static final long MAX_PAGE_SIZE = 100L;

    private final AlertLogMapper alertLogMapper;

    @Override
    public List<AlertVO> listAlerts(String status) {
        String normalizedStatus = normalizeQueryStatus(status);
        return alertLogMapper.selectList(buildBaseQuery(normalizedStatus, null, null, null))
                .stream()
                .map(this::toAlertVO)
                .toList();
    }

    @Override
    public PageResult<AlertLogVO> getAlertLogs(String alertType,
                                               String status,
                                               LocalDateTime startTime,
                                               LocalDateTime endTime,
                                               Long current,
                                               Long pageSize) {
        validateTimeRange(startTime, endTime);
        String normalizedStatus = normalizeQueryStatus(status);
        String normalizedAlertType = normalizeAlertType(alertType);
        long currentPage = current == null ? 1L : current;
        long size = pageSize == null ? 10L : Math.min(pageSize, MAX_PAGE_SIZE);

        Page<AlertLog> page = new Page<>(currentPage, size);
        Page<AlertLog> result = alertLogMapper.selectPage(page,
                buildBaseQuery(normalizedStatus, normalizedAlertType, startTime, endTime));

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
                                                        LocalDateTime startTime,
                                                        LocalDateTime endTime) {
        LambdaQueryWrapper<AlertLog> queryWrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(status)) {
            queryWrapper.eq(AlertLog::getStatus, status);
        }
        if (StringUtils.hasText(alertType)) {
            queryWrapper.eq(AlertLog::getAlertType, alertType);
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
                .title(alertLog.getTitle())
                .content(alertLog.getContent())
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
                .title(alertLog.getTitle())
                .content(alertLog.getContent())
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
}
