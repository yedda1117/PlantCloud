package com.plantcloud.strategy.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.plantcloud.common.model.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@TableName("user_notifications")
@EqualsAndHashCode(callSuper = true)
public class UserNotification extends BaseEntity {

    private Long plantId;
    private String notificationType;
    private String title;
    private String content;
    private LocalDateTime createdAt;
}
