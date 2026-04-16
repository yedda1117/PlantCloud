package com.plantcloud.strategy.controller;

import com.plantcloud.common.result.Result;
import com.plantcloud.strategy.dto.AutoControlStrategyUpsertDTO;
import com.plantcloud.strategy.dto.ScheduleStrategyCreateDTO;
import com.plantcloud.strategy.dto.ThresholdStrategyUpsertDTO;
import com.plantcloud.strategy.service.StrategyService;
import com.plantcloud.strategy.vo.StrategyVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/strategies")
@RequiredArgsConstructor
public class StrategyController {

    private final StrategyService strategyService;

    @GetMapping("/threshold")
    public Result<StrategyVO> getThresholdStrategy(@RequestParam Long plantId) {
        return Result.ok(strategyService.getThresholdStrategy(plantId));
    }

    @PutMapping("/threshold")
    public Result<StrategyVO> upsertThresholdStrategy(@Valid @RequestBody ThresholdStrategyUpsertDTO request) {
        return Result.ok(strategyService.upsertThresholdStrategy(request));
    }

    @GetMapping("/auto-control")
    public Result<StrategyVO> getAutoControlStrategy(@RequestParam Long plantId) {
        return Result.ok(strategyService.getAutoControlStrategy(plantId));
    }

    @PutMapping("/auto-control")
    public Result<StrategyVO> upsertAutoControlStrategy(@Valid @RequestBody AutoControlStrategyUpsertDTO request) {
        return Result.ok(strategyService.upsertAutoControlStrategy(request));
    }

    @GetMapping("/schedule")
    public Result<List<StrategyVO>> getScheduleStrategies(@RequestParam Long plantId) {
        return Result.ok(strategyService.getScheduleStrategies(plantId));
    }

    @PostMapping("/schedule")
    public Result<StrategyVO> createScheduleStrategy(@Valid @RequestBody ScheduleStrategyCreateDTO request) {
        return Result.ok(strategyService.createScheduleStrategy(request));
    }

    @PutMapping("/schedule/{scheduleId}")
    public Result<StrategyVO> updateScheduleStrategy(@PathVariable Long scheduleId,
                                                     @Valid @RequestBody ScheduleStrategyCreateDTO request) {
        return Result.ok(strategyService.updateScheduleStrategy(scheduleId, request));
    }

    @DeleteMapping("/schedule/{scheduleId}")
    public Result<Void> deleteScheduleStrategy(@PathVariable Long scheduleId) {
        strategyService.deleteScheduleStrategy(scheduleId);
        return Result.ok(null);
    }
}
