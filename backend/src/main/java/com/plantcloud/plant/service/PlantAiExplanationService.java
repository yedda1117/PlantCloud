package com.plantcloud.plant.service;

import com.plantcloud.plant.vo.AiExplanationVO;
import com.plantcloud.plant.vo.PlantPredictionAiVO;
import com.plantcloud.plant.vo.RiskAnalysisResultVO;

public interface PlantAiExplanationService {

    AiExplanationVO generateExplanation(RiskAnalysisResultVO result);

    PlantPredictionAiVO generatePredictionExplanation(String prompt);
}
