package com.plantcloud.strategy.mapper;

import org.apache.ibatis.jdbc.SQL;
import org.springframework.util.StringUtils;

import java.util.Map;

public class StrategySqlProvider {

    public String buildSelectByPlantIdAndFilters(Map<String, Object> params) {
        Boolean enabled = (Boolean) params.get("enabled");
        String strategyType = (String) params.get("strategyType");
        return new SQL() {{
            SELECT("id, plant_id, created_by, strategy_name, strategy_type, target_device_id, metric_type, " +
                    "operator_type, threshold_min, threshold_max, action_type, action_value, cron_expr, enabled, " +
                    "priority, config_json, created_at, updated_at");
            FROM("strategies");
            WHERE("plant_id = #{plantId}");
            if (enabled != null) {
                WHERE("enabled = #{enabled}");
            }
            if (StringUtils.hasText(strategyType)) {
                WHERE("strategy_type = #{strategyType}");
            }
            ORDER_BY("priority DESC, id DESC");
        }}.toString();
    }

    public String buildSelectConflictCandidates(Map<String, Object> params) {
        String actionType = (String) params.get("actionType");
        String strategyType = (String) params.get("strategyType");
        String metricType = (String) params.get("metricType");
        String cronExpr = (String) params.get("cronExpr");
        Long targetDeviceId = (Long) params.get("targetDeviceId");
        Long excludeId = (Long) params.get("excludeId");
        return new SQL() {{
            SELECT("id, plant_id, created_by, strategy_name, strategy_type, target_device_id, metric_type, " +
                    "operator_type, threshold_min, threshold_max, action_type, action_value, cron_expr, enabled, " +
                    "priority, config_json, created_at, updated_at");
            FROM("strategies");
            WHERE("plant_id = #{plantId}");
            WHERE("enabled = 1");
            WHERE("strategy_type = #{strategyType}");
            WHERE("action_type = #{actionType}");
            if (excludeId != null) {
                WHERE("id <> #{excludeId}");
            }
            if (!"NOTIFY_USER".equals(actionType)) {
                if (targetDeviceId == null) {
                    WHERE("1 = 0");
                } else {
                    WHERE("target_device_id = #{targetDeviceId}");
                }
            }
            if ("CONDITION".equals(strategyType) && StringUtils.hasText(metricType)) {
                WHERE("metric_type = #{metricType}");
            }
            if ("SCHEDULE".equals(strategyType) && StringUtils.hasText(cronExpr)) {
                WHERE("cron_expr = #{cronExpr}");
            }
            ORDER_BY("priority DESC, id DESC");
        }}.toString();
    }
}
