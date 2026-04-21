package com.plantcloud.control.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.plantcloud.common.model.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@TableName("device_command_logs")
@EqualsAndHashCode(callSuper = true)
public class DeviceCommandLog extends BaseEntity {

    @TableField("plant_id")
    private Long plantId;

    @TableField("device_id")
    private Long deviceId;

    @TableField("operator_user_id")
    private Long operatorUserId;

    @TableField("source_type")
    private String sourceType;

    @TableField("command_name")
    private String commandName;

    @TableField("command_value")
    private String commandValue;

    @TableField("request_payload")
    private String requestPayload;

    @TableField("response_payload")
    private String responsePayload;

    @TableField("execute_status")
    private String executeStatus;

    @TableField("error_message")
    private String errorMessage;

    @TableField("executed_at")
    private LocalDateTime executedAt;

    @TableField("created_at")
    private LocalDateTime createdAt;
}