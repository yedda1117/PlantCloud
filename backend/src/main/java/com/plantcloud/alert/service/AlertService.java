package com.plantcloud.alert.service;

import com.plantcloud.alert.entity.AlertLog;
import com.plantcloud.alert.vo.AlertLogVO;
import com.plantcloud.alert.vo.AlertVO;
import com.plantcloud.common.result.PageResult;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AlertService {

    List<AlertVO> listAlerts(String status);

    /**
     * Same ordering as {@link #listAlerts(String)} with {@code UNRESOLVED}: {@code createdAt} descending.
     * Within that order, returns the {@code metricValue} of the first row for the plant whose
     * {@code metricName} is {@code smoke_gas_ppm}.
     */
    Optional<BigDecimal> findFirstUnresolvedSmokeGasPpmForPlant(Long plantId);

    PageResult<AlertLogVO> getAlertLogs(String alertType,
                                        String status,
                                        Long deviceId,
                                        LocalDateTime startTime,
                                        LocalDateTime endTime,
                                        Long current,
                                        Long pageSize);

    AlertLogVO resolveAlert(Long alertId, Long resolvedBy);

    AlertLogVO createAlert(AlertLog alertLog);
}
