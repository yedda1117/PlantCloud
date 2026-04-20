package com.plantcloud.plant.controller;

import com.plantcloud.common.result.Result;
import com.plantcloud.plant.service.PlantService;
import com.plantcloud.plant.vo.PlantSimpleVO;
import com.plantcloud.plant.vo.RiskAnalysisResultVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/plants")
@RequiredArgsConstructor
public class PlantController {

    private static final Long DEFAULT_OWNER_ID = 1L;

    private final PlantService plantService;

    @GetMapping
    public Result<List<PlantSimpleVO>> listPlants() {
        List<PlantSimpleVO> data = plantService.listSimplePlants(DEFAULT_OWNER_ID);
        return Result.ok(data);
    }

    @PostMapping("/{id}/analyze-risk")
    public Result<RiskAnalysisResultVO> analyzeRisk(@PathVariable("id") Long plantId) {
        return Result.ok(plantService.analyzeRisk(plantId));
    }
}
