package com.plantcloud.plant.controller;

import com.plantcloud.common.result.Result;
import com.plantcloud.plant.service.PlantAnalysisService;
import com.plantcloud.plant.vo.PlantAnalysisVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/plant")
@RequiredArgsConstructor
public class PlantAnalysisController {

    private final PlantAnalysisService plantAnalysisService;

    @PostMapping("/{id}/analysis")
    public Result<PlantAnalysisVO> analyze(@PathVariable("id") Long plantId) {
        return Result.ok(plantAnalysisService.analyze(plantId));
    }
}
