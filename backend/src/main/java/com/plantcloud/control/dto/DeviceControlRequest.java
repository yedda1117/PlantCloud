package com.plantcloud.control.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class DeviceControlRequest {

    @NotNull
    private Long plantId;

    @NotNull
    private Long deviceId;

    @NotBlank
    private String commandValue;

    private String sourceType;
}
