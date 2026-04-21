package com.plantcloud.plant.service;

import com.plantcloud.plant.vo.PlantAnalysisVO;

public interface PlantAnalysisService {

    PlantAnalysisVO analyze(Long plantId);
}
