package com.plantcloud.plant.service;

import com.plantcloud.plant.vo.PlantSimpleVO;
import com.plantcloud.plant.vo.RiskAnalysisResultVO;

import java.util.List;

public interface PlantService {

    List<PlantSimpleVO> listSimplePlants(Long ownerId);

    RiskAnalysisResultVO analyzeRisk(Long plantId);
}
