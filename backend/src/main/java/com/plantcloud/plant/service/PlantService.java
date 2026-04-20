package com.plantcloud.plant.service;

import com.plantcloud.plant.vo.PlantSimpleVO;

import java.util.List;

public interface PlantService {

    List<PlantSimpleVO> listSimplePlants(Long ownerId);
}
