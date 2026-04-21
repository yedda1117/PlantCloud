package com.plantcloud.plant.service;

import com.plantcloud.plant.dto.PlantAiGenerateRequest;
import com.plantcloud.plant.vo.PlantTemplateGenerateVO;

public interface PlantConfigService {

    PlantTemplateGenerateVO generateTemplate(PlantAiGenerateRequest request);
}
