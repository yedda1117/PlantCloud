package com.plantcloud.device.controller;

import com.plantcloud.common.result.Result;
import com.plantcloud.device.dto.DeviceBindPlantRequest;
import com.plantcloud.device.service.DeviceBindingService;
import com.plantcloud.device.service.DeviceQueryService;
import com.plantcloud.device.vo.DeviceBindResponseVO;
import com.plantcloud.device.vo.DevicesStatusVO;
import com.plantcloud.device.vo.InfraredStatusVO;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/devices")
@RequiredArgsConstructor
public class DeviceController {

    private final DeviceQueryService deviceQueryService;
    private final DeviceBindingService deviceBindingService;

    @GetMapping("/status")
    public Result<DevicesStatusVO> getDevicesStatus(@RequestParam Long plantId) {
        return Result.ok(deviceQueryService.getDevicesStatus(plantId));
    }

    @GetMapping("/infrared")
    public Result<InfraredStatusVO> getInfraredStatus(@RequestParam(value = "date", required = false) String date) {
        return Result.ok(deviceQueryService.getInfraredStatus(date));
    }

    @Operation(summary = "设备绑定植物")
    @PostMapping("/bind-plant")
    public Result<DeviceBindResponseVO> bindPlant(@Valid @RequestBody DeviceBindPlantRequest request) {
        return Result.ok(deviceBindingService.bindPlant(request));
    }
}
