package com.plantcloud.device.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class DeviceBindPlantRequest {

    @NotNull
    private Long plantId;
}
