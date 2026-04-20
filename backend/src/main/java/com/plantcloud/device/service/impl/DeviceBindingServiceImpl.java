package com.plantcloud.device.service.impl;

import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.device.dto.DeviceBindPlantRequest;
import com.plantcloud.device.entity.Device;
import com.plantcloud.device.mapper.DeviceMapper;
import com.plantcloud.device.service.DeviceBindingService;
import com.plantcloud.device.vo.DeviceBindResponseVO;
import com.plantcloud.plant.entity.Plant;
import com.plantcloud.plant.mapper.PlantMapper;
import com.plantcloud.system.exception.BizException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DeviceBindingServiceImpl implements DeviceBindingService {

    private static final String ACTIVE_PLANT_STATUS = "ACTIVE";

    private final DeviceMapper deviceMapper;
    private final PlantMapper plantMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public DeviceBindResponseVO bindPlant(Long deviceId, DeviceBindPlantRequest request) {
        Device device = requireDevice(deviceId);
        Plant plant = requireActivePlant(request.getPlantId());

        device.setPlantId(plant.getId());
        deviceMapper.updateById(device);

        return buildResponse(device, plant);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public DeviceBindResponseVO unbindPlant(Long deviceId) {
        Device device = requireDevice(deviceId);

        deviceMapper.update(null, new LambdaUpdateWrapper<Device>()
                .eq(Device::getId, deviceId)
                .set(Device::getPlantId, null));

        return buildResponse(device, null);
    }

    private Device requireDevice(Long deviceId) {
        Device device = deviceMapper.selectById(deviceId);
        if (device == null) {
            throw new BizException(ResultCode.NOT_FOUND.getCode(), "Device not found");
        }
        return device;
    }

    private Plant requireActivePlant(Long plantId) {
        Plant plant = plantMapper.selectById(plantId);
        if (plant == null) {
            throw new BizException(ResultCode.NOT_FOUND.getCode(), "Plant not found");
        }
        if (!ACTIVE_PLANT_STATUS.equalsIgnoreCase(plant.getStatus())) {
            throw new BizException(ResultCode.BAD_REQUEST.getCode(), "Plant status does not allow binding");
        }
        return plant;
    }

    private DeviceBindResponseVO buildResponse(Device device, Plant plant) {
        return DeviceBindResponseVO.builder()
                .deviceId(device.getId())
                .deviceCode(device.getDeviceCode())
                .plantId(plant != null ? plant.getId() : null)
                .plantName(plant != null ? plant.getPlantName() : null)
                .build();
    }
}
