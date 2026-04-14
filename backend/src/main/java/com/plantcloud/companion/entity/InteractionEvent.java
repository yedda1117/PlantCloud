package com.plantcloud.companion.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.plantcloud.common.model.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@TableName("interaction_events")
@EqualsAndHashCode(callSuper = true)
public class InteractionEvent extends BaseEntity {

    private Long plantId;
    private Long deviceId;
    private String eventType;
    private String eventTitle;
    private String eventContent;
    private Integer eventCount;
    private LocalDateTime detectedAt;
    private String extraData;
    private LocalDateTime createdAt;
}
