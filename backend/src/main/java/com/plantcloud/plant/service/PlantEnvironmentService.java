package com.plantcloud.plant.service;

import com.plantcloud.plant.vo.PlantEnvironmentSnapshotVO;

public interface PlantEnvironmentService {

    PlantEnvironmentSnapshotVO getEnvironmentSnapshot(Long plantId);
}
