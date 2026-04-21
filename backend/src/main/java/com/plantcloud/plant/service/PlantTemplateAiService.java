package com.plantcloud.plant.service;

import com.plantcloud.plant.dto.PlantTemplateDataDTO;

public interface PlantTemplateAiService {

    PlantTemplateDataDTO generateTemplate(String plantName);
}
