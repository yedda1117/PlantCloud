package com.plantcloud.plant.service.impl;

import com.plantcloud.plant.mapper.PlantMapper;
import com.plantcloud.plant.service.PlantService;
import com.plantcloud.plant.vo.PlantSimpleVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PlantServiceImpl implements PlantService {

    private final PlantMapper plantMapper;

    @Override
    public List<PlantSimpleVO> listSimplePlants(Long ownerId) {
        return plantMapper.selectSimplePlants(ownerId);
    }
}
