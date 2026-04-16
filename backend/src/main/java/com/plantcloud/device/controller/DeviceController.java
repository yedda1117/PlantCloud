package com.plantcloud.device.controller;

import com.plantcloud.common.result.Result;
import com.plantcloud.device.service.DeviceQueryService;
import com.plantcloud.device.vo.DevicesStatusVO;
import com.plantcloud.device.vo.InfraredStatusVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/devices")
@RequiredArgsConstructor
public class DeviceController {

    private final DeviceQueryService deviceQueryService;

    @GetMapping("/status")
    public Result<DevicesStatusVO> getDevicesStatus() {
        return Result.ok(deviceQueryService.getDevicesStatus());
    }

    @GetMapping("/infrared")
    public Result<InfraredStatusVO> getInfraredStatus(@RequestParam(value = "date", required = false) String date) {
        return Result.ok(deviceQueryService.getInfraredStatus(date));
    }
}
