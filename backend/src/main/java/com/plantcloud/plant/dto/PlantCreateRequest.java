package com.plantcloud.plant.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PlantCreateRequest {

    @NotBlank(message = "植物名称不能为空")
    private String plantName;

    @Valid
    @NotNull(message = "templateData不能为空")
    private PlantTemplateDataDTO templateData;
}
