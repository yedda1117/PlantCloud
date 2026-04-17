package com.plantcloud.strategy.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.plantcloud.strategy.entity.Strategy;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.SelectProvider;

import java.util.List;

public interface StrategyMapper extends BaseMapper<Strategy> {

    @SelectProvider(type = StrategySqlProvider.class, method = "buildSelectByPlantIdAndFilters")
    List<Strategy> selectByPlantIdAndFilters(@Param("plantId") Long plantId,
                                             @Param("enabled") Boolean enabled,
                                             @Param("strategyType") String strategyType);

    @SelectProvider(type = StrategySqlProvider.class, method = "buildSelectConflictCandidates")
    List<Strategy> selectConflictCandidates(@Param("plantId") Long plantId,
                                            @Param("strategyType") String strategyType,
                                            @Param("actionType") String actionType,
                                            @Param("targetDeviceId") Long targetDeviceId,
                                            @Param("metricType") String metricType,
                                            @Param("cronExpr") String cronExpr,
                                            @Param("excludeId") Long excludeId);
}
