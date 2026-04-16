package com.plantcloud.strategy.service.impl;

import com.plantcloud.strategy.dto.AutoControlStrategyUpsertDTO;
import com.plantcloud.strategy.dto.ScheduleStrategyCreateDTO;
import com.plantcloud.strategy.dto.ThresholdStrategyUpsertDTO;
import com.plantcloud.strategy.service.StrategyService;
import com.plantcloud.strategy.vo.StrategyVO;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

@Service
public class StrategyServiceImpl implements StrategyService {

    @Override
    public StrategyVO getThresholdStrategy(Long plantId) {
        return StrategyVO.builder().plantId(plantId).strategyType("THRESHOLD_ALERT").build();
    }

    @Override
    public StrategyVO upsertThresholdStrategy(ThresholdStrategyUpsertDTO request) {
        return StrategyVO.builder().plantId(request.getPlantId()).strategyType("THRESHOLD_ALERT").build();
    }

    @Override
    public StrategyVO getAutoControlStrategy(Long plantId) {
        return StrategyVO.builder().plantId(plantId).strategyType("AUTO_CONTROL").build();
    }

    @Override
    public StrategyVO upsertAutoControlStrategy(AutoControlStrategyUpsertDTO request) {
        return StrategyVO.builder().plantId(request.getPlantId()).strategyType("AUTO_CONTROL").build();
    }

    @Override
    public List<StrategyVO> getScheduleStrategies(Long plantId) {
        return Collections.emptyList();
    }

    @Override
    public StrategyVO createScheduleStrategy(ScheduleStrategyCreateDTO request) {
        return StrategyVO.builder()
                .plantId(request.getPlantId())
                .strategyName(request.getStrategyName())
                .strategyType("SCHEDULED_CONTROL")
                .cronExpr(request.getCronExpr())
                .build();
    }

    @Override
    public StrategyVO updateScheduleStrategy(Long scheduleId, ScheduleStrategyCreateDTO request) {
        return StrategyVO.builder()
                .id(scheduleId)
                .plantId(request.getPlantId())
                .strategyName(request.getStrategyName())
                .strategyType("SCHEDULED_CONTROL")
                .cronExpr(request.getCronExpr())
                .build();
    }

    @Override
    public void deleteScheduleStrategy(Long scheduleId) {
    }
}
