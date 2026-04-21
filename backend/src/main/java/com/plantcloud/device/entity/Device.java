package com.plantcloud.device.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.plantcloud.common.model.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@TableName("devices")
@EqualsAndHashCode(callSuper = true)
public class Device extends BaseEntity {

    @TableField("plant_id")
    private Long plantId;

    @TableField("device_code")
    private String deviceCode;

    @TableField("device_name")
    private String deviceName;

    @TableField("device_type")
    private String deviceType;

    @TableField("mqtt_topic_up")
    private String mqttTopicUp;

    @TableField("mqtt_topic_down")
    private String mqttTopicDown;

    @TableField("online_status")
    private String onlineStatus;

    @TableField("current_status")
    private String currentStatus;

    @TableField("firmware_version")
    private String firmwareVersion;

    @TableField("last_seen_at")
    private LocalDateTime lastSeenAt;

    @TableField("remark")
    private String remark;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("updated_at")
    private LocalDateTime updatedAt;
}