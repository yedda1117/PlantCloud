package com.plantcloud.plant.controller;

import com.plantcloud.common.result.Result;
import com.plantcloud.plant.dto.PlantAiGenerateRequest;
import com.plantcloud.plant.service.PlantConfigService;
import com.plantcloud.plant.vo.PlantTemplateGenerateVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/plant-config")
@RequiredArgsConstructor
public class PlantConfigController {

    private final PlantConfigService plantConfigService;

    @PostMapping("/ai-generate")
    public Result<PlantTemplateGenerateVO> generateTemplate(@Valid @RequestBody PlantAiGenerateRequest request) {
        return Result.ok(plantConfigService.generateTemplate(request));
    }
}
