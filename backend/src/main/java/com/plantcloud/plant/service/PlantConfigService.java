package com.plantcloud.plant.service;

import com.plantcloud.plant.dto.PlantAiGenerateRequest;
import com.plantcloud.plant.vo.PlantTemplateGenerateVO;
import com.plantcloud.plant.vo.PlantTemplatePublicVO;

import java.util.List;

public interface PlantConfigService {

    PlantTemplateGenerateVO generateTemplate(PlantAiGenerateRequest request);

    List<PlantTemplatePublicVO> listPublicTemplates();
}
