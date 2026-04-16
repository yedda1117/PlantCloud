package com.plantcloud.strategy.service;

import com.plantcloud.strategy.dto.AutoControlStrategyUpsertDTO;
import com.plantcloud.strategy.dto.ScheduleStrategyCreateDTO;
import com.plantcloud.strategy.dto.ThresholdStrategyUpsertDTO;
import com.plantcloud.strategy.vo.StrategyVO;

import java.util.List;

public interface StrategyService {

    StrategyVO getThresholdStrategy(Long plantId);

    StrategyVO upsertThresholdStrategy(ThresholdStrategyUpsertDTO request);

    StrategyVO getAutoControlStrategy(Long plantId);

    StrategyVO upsertAutoControlStrategy(AutoControlStrategyUpsertDTO request);

    List<StrategyVO> getScheduleStrategies(Long plantId);

    StrategyVO createScheduleStrategy(ScheduleStrategyCreateDTO request);

    StrategyVO updateScheduleStrategy(Long scheduleId, ScheduleStrategyCreateDTO request);

    void deleteScheduleStrategy(Long scheduleId);
}
