package com.plantcloud.alert.service;

import com.plantcloud.alert.entity.AlertLog;
import com.plantcloud.alert.vo.AlertLogVO;
import com.plantcloud.alert.vo.AlertVO;
import com.plantcloud.common.result.PageResult;

import java.time.LocalDateTime;
import java.util.List;

public interface AlertService {

    List<AlertVO> listAlerts(String status);

    PageResult<AlertLogVO> getAlertLogs(String alertType,
                                        String status,
                                        LocalDateTime startTime,
                                        LocalDateTime endTime,
                                        Long current,
                                        Long pageSize);

    AlertLogVO resolveAlert(Long alertId, Long resolvedBy);

    AlertLogVO createAlert(AlertLog alertLog);
}
