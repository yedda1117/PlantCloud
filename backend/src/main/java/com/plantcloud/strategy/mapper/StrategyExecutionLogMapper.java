package com.plantcloud.strategy.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.plantcloud.strategy.entity.StrategyExecutionLog;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface StrategyExecutionLogMapper extends BaseMapper<StrategyExecutionLog> {

    @Select("""
            SELECT id, strategy_id, plant_id, trigger_source, trigger_metric_value, trigger_payload,
                   execution_result, result_message, command_log_id, executed_at
            FROM strategy_execution_logs
            WHERE strategy_id = #{strategyId}
            ORDER BY executed_at DESC
            LIMIT #{pageSize} OFFSET #{offset}
            """)
    List<StrategyExecutionLog> selectPageByStrategyId(@Param("strategyId") Long strategyId,
                                                      @Param("offset") Long offset,
                                                      @Param("pageSize") Long pageSize);

    @Select("""
            SELECT COUNT(1)
            FROM strategy_execution_logs
            WHERE strategy_id = #{strategyId}
            """)
    long countByStrategyId(@Param("strategyId") Long strategyId);
}
