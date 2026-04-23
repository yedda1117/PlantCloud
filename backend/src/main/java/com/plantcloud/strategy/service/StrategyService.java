package com.plantcloud.strategy.service;

import com.plantcloud.strategy.dto.StrategyLogQueryDTO;
import com.plantcloud.strategy.dto.StrategyQueryDTO;
import com.plantcloud.strategy.dto.StrategyUpsertDTO;
import com.plantcloud.strategy.vo.PageResult;
import com.plantcloud.strategy.vo.StrategyExecutionLogVO;
import com.plantcloud.strategy.vo.StrategyVO;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public interface StrategyService {

    List<StrategyVO> listStrategies(StrategyQueryDTO query);

    StrategyVO getStrategy(Long strategyId);

    StrategyVO createStrategy(StrategyUpsertDTO request);

    StrategyVO updateStrategy(Long strategyId, StrategyUpsertDTO request);

    void deleteStrategy(Long strategyId);

    PageResult<StrategyExecutionLogVO> getStrategyLogs(Long strategyId, StrategyLogQueryDTO query);

    void evaluateStrategiesForPlant(Long plantId, String triggerSource);

    void evaluateStrategiesForPlant(Long plantId, String triggerSource, Map<String, BigDecimal> currentMetricValues);
}
