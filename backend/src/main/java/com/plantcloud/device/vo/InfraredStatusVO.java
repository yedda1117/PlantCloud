package com.plantcloud.device.vo;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class InfraredStatusVO {

    private Long plantId;
    private Long deviceId;
    private String deviceCode;
    private String deviceName;
    private String queryDate;
    private Boolean currentDetected;
    private String latestEventTitle;
    private String latestEventContent;
    private String latestDetectedAt;
    private Integer approachCount;
    private Integer leaveCount;
    private List<InfraredEventVO> events;

    @Data
    @Builder
    public static class InfraredEventVO {
        private Long id;
        private String eventType;
        private String eventTitle;
        private String eventContent;
        private Integer status;
        private String detectedAt;
        private String extraData;
    }
}
