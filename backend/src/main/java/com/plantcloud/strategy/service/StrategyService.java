package com.plantcloud.strategy.service;

import com.plantcloud.strategy.dto.StrategyLogQueryDTO;
import com.plantcloud.strategy.dto.StrategyQueryDTO;
import com.plantcloud.strategy.dto.StrategyUpsertDTO;
import com.plantcloud.strategy.vo.PageResult;
import com.plantcloud.strategy.vo.StrategyExecutionLogVO;
import com.plantcloud.strategy.vo.StrategyVO;

import java.util.List;

public interface StrategyService {

    List<StrategyVO> listStrategies(StrategyQueryDTO query);

    StrategyVO getStrategy(Long strategyId);

    StrategyVO createStrategy(StrategyUpsertDTO request);

    StrategyVO updateStrategy(Long strategyId, StrategyUpsertDTO request);

    void deleteStrategy(Long strategyId);

    PageResult<StrategyExecutionLogVO> getStrategyLogs(Long strategyId, StrategyLogQueryDTO query);
}
