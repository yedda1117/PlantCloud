package com.plantcloud.strategy.controller;

import com.plantcloud.common.result.Result;
import com.plantcloud.strategy.dto.StrategyLogQueryDTO;
import com.plantcloud.strategy.dto.StrategyQueryDTO;
import com.plantcloud.strategy.dto.StrategyUpsertDTO;
import com.plantcloud.strategy.service.StrategyService;
import com.plantcloud.strategy.vo.PageResult;
import com.plantcloud.strategy.vo.StrategyExecutionLogVO;
import com.plantcloud.strategy.vo.StrategyVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/strategies")
@RequiredArgsConstructor
public class StrategyController {

    private final StrategyService strategyService;

    @GetMapping
    public Result<List<StrategyVO>> listStrategies(@Valid @ModelAttribute StrategyQueryDTO query) {
        return Result.ok(strategyService.listStrategies(query));
    }

    @GetMapping("/{strategyId}")
    public Result<StrategyVO> getStrategy(@PathVariable Long strategyId) {
        return Result.ok(strategyService.getStrategy(strategyId));
    }

    @PostMapping
    public Result<StrategyVO> createStrategy(@Valid @RequestBody StrategyUpsertDTO request) {
        return Result.ok(strategyService.createStrategy(request));
    }

    @PutMapping("/{strategyId}")
    public Result<StrategyVO> updateStrategy(@PathVariable Long strategyId,
                                             @Valid @RequestBody StrategyUpsertDTO request) {
        return Result.ok(strategyService.updateStrategy(strategyId, request));
    }

    @DeleteMapping("/{strategyId}")
    public Result<Void> deleteStrategy(@PathVariable Long strategyId) {
        strategyService.deleteStrategy(strategyId);
        return Result.ok(null);
    }

    @GetMapping("/{strategyId}/logs")
    public Result<PageResult<StrategyExecutionLogVO>> getStrategyLogs(@PathVariable Long strategyId,
                                                                      @Valid @ModelAttribute StrategyLogQueryDTO query) {
        return Result.ok(strategyService.getStrategyLogs(strategyId, query));
    }
}
