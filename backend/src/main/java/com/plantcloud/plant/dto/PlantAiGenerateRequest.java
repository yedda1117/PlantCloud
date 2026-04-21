package com.plantcloud.plant.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PlantAiGenerateRequest {

    @NotBlank(message = "植物名称不能为空")
    private String plantName;
}
