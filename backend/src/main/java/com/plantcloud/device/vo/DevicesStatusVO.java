package com.plantcloud.device.vo;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DevicesStatusVO {

    private Long plantId;
    private DeviceRuntimeStatusVO light;
    private DeviceRuntimeStatusVO fan;
    private InfraredDeviceStatusVO infrared;

    @Data
    @Builder
    public static class DeviceRuntimeStatusVO {
        private Long deviceId;
        private String deviceCode;
        private String deviceName;
        private String deviceType;
        private String onlineStatus;
        private String workingStatus;
        private Boolean powerOn;
        private String lastSeenAt;
        private String rawStatus;
    }

    @Data
    @Builder
    public static class InfraredDeviceStatusVO {
        private Long deviceId;
        private String deviceCode;
        private String deviceName;
        private String deviceType;
        private String onlineStatus;
        private Boolean detected;
        private String latestEventTitle;
        private String latestDetectedAt;
        private String lastSeenAt;
        private String rawStatus;
    }
}
