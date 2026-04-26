package com.plantcloud.strategy.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.plantcloud.common.model.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@TableName("strategy_device_effects")
@EqualsAndHashCode(callSuper = true)
public class StrategyDeviceEffect extends BaseEntity {

    @TableField("strategy_id")
    private Long strategyId;

    @TableField("plant_id")
    private Long plantId;

    @TableField("device_id")
    private Long deviceId;

    @TableField("control_target")
    private String controlTarget;

    @TableField("before_state")
    private String beforeState;

    @TableField("applied_state")
    private String appliedState;

    @TableField("apply_command_log_id")
    private Long applyCommandLogId;

    @TableField("active")
    private Boolean active;

    @TableField("closed_reason")
    private String closedReason;

    @TableField("closed_by_source_type")
    private String closedBySourceType;

    @TableField("closed_by_command_log_id")
    private Long closedByCommandLogId;

    @TableField("closed_at")
    private LocalDateTime closedAt;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("updated_at")
    private LocalDateTime updatedAt;
}
