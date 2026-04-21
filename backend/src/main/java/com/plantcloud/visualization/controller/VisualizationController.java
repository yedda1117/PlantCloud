package com.plantcloud.visualization.controller;

import com.plantcloud.common.result.Result;
import com.plantcloud.visualization.service.VisualizationService;
import com.plantcloud.visualization.vo.CalendarDayVO;
import com.plantcloud.visualization.vo.CalendarDetailVO;
import com.plantcloud.visualization.vo.EnvironmentHistoryVO;
import com.plantcloud.visualization.vo.StrategyExecutionLogVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/visualization")
@RequiredArgsConstructor
public class VisualizationController {

    private final VisualizationService visualizationService;

    @GetMapping("/history")
    public Result<EnvironmentHistoryVO> getHistory(@RequestParam("start_time") String startTime,
                                                   @RequestParam("end_time") String endTime,
                                                   @RequestParam(required = false, defaultValue = "hour") String granularity,
                                                   @RequestParam(required = false) String metrics,
                                                   @RequestParam(required = false) Long plantId,
                                                   @RequestParam(value = "plant_type", required = false) String plantType) {
        return Result.ok(visualizationService.getHistory(startTime, endTime, granularity, metrics, plantId, plantType));
    }

    @GetMapping("/calendar")
    public Result<List<CalendarDayVO>> getCalendar(@RequestParam Long plantId,
                                                   @RequestParam(required = false) String month) {
        return Result.ok(visualizationService.getCalendar(plantId, month));
    }

    @GetMapping("/calendar/{date}")
    public Result<CalendarDetailVO> getCalendarDetail(@RequestParam Long plantId, @PathVariable String date) {
        return Result.ok(visualizationService.getCalendarDetail(plantId, date));
    }

    @GetMapping("/strategy-logs")
    public Result<List<StrategyExecutionLogVO>> getStrategyLogs(@RequestParam Long plantId) {
        return Result.ok(visualizationService.getStrategyLogs(plantId));
    }
}
