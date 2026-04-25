package com.plantcloud.alert.controller;

import com.plantcloud.alert.service.AlertService;
import com.plantcloud.alert.vo.AlertLogVO;
import com.plantcloud.alert.vo.AlertVO;
import com.plantcloud.common.result.PageResult;
import com.plantcloud.common.result.Result;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.util.List;

@Validated
@RestController
@RequestMapping("/alerts")
@RequiredArgsConstructor
public class AlertController {
    private static final Logger log = LoggerFactory.getLogger(AlertController.class);

    private final AlertService alertService;

    @GetMapping
    public Result<List<AlertVO>> listAlerts(@RequestParam(required = false) String status) {
        return Result.ok(alertService.listAlerts(status));
    }

    @GetMapping("/logs")
    public Result<PageResult<AlertLogVO>> getAlertLogs(@RequestParam(value = "alert_type", required = false) String alertType,
                                                       @RequestParam(required = false) String status,
                                                       @RequestParam(value = "device_id", required = false) Long deviceId,
                                                       @RequestParam(value = "start_time", required = false)
                                                       @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
                                                       LocalDateTime startTime,
                                                       @RequestParam(value = "end_time", required = false)
                                                       @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
                                                       LocalDateTime endTime,
                                                       @RequestParam(defaultValue = "1")
                                                       @Min(value = 1, message = "current must be greater than or equal to 1")
                                                       Long current,
                                                       @RequestParam(defaultValue = "10")
                                                       @Min(value = 1, message = "pageSize must be greater than or equal to 1")
                                                       @Max(value = 100, message = "pageSize must be less than or equal to 100")
                                                       Long pageSize) {
        log.info("[ALERTS_LOGS] request alertType={}, status={}, deviceId={}, startTime={}, endTime={}, current={}, pageSize={}",
                alertType, status, deviceId, startTime, endTime, current, pageSize);
        return Result.ok(alertService.getAlertLogs(alertType, status, deviceId, startTime, endTime, current, pageSize));
    }
}
