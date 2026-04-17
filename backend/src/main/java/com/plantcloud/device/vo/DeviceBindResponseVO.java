package com.plantcloud.device.vo;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DeviceBindResponseVO {

    private Long deviceId;
    private String deviceCode;
    private Long plantId;
    private String plantName;
}
