package com.plantcloud.device.service;

import com.plantcloud.device.vo.DevicesStatusVO;
import com.plantcloud.device.vo.InfraredStatusVO;

public interface DeviceQueryService {

    DevicesStatusVO getDevicesStatus();

    InfraredStatusVO getInfraredStatus(String date);
}
