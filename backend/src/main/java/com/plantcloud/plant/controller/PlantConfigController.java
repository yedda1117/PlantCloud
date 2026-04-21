package com.plantcloud.plant.controller;

import com.plantcloud.common.result.Result;
import com.plantcloud.plant.dto.PlantAiGenerateRequest;
import com.plantcloud.plant.dto.PlantTemplateCreateRequest;
import com.plantcloud.plant.service.PlantConfigService;
import com.plantcloud.plant.vo.PlantTemplateGenerateVO;
import com.plantcloud.plant.vo.PlantTemplatePublicVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

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

    @PostMapping("/templates")
    public Result<PlantTemplatePublicVO> createTemplate(@Valid @RequestBody PlantTemplateCreateRequest request) {
        return Result.ok(plantConfigService.createTemplate(request));
    }

    @PutMapping("/templates/{plantId}")
    public Result<PlantTemplatePublicVO> updateTemplateByPlantId(@PathVariable("plantId") Long plantId,
                                                                 @Valid @RequestBody PlantTemplateCreateRequest request) {
        return Result.ok(plantConfigService.updateTemplateByPlantId(plantId, request));
    }

    @GetMapping("/templates")
    public Result<List<PlantTemplatePublicVO>> listTemplates() {
        return Result.ok(plantConfigService.listPublicTemplates());
    }

    @GetMapping("/templates/{plantId}")
    public Result<PlantTemplatePublicVO> getTemplateByPlantId(@PathVariable("plantId") Long plantId) {
        return Result.ok(plantConfigService.getTemplateByPlantId(plantId));
    }
}
