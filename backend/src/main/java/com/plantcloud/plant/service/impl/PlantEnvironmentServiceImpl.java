package com.plantcloud.plant.service.impl;

import com.plantcloud.plant.mapper.PlantMapper;
import com.plantcloud.plant.service.PlantEnvironmentService;
import com.plantcloud.plant.vo.PlantEnvironmentSnapshotVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class PlantEnvironmentServiceImpl implements PlantEnvironmentService {

    private static final BigDecimal ZERO = BigDecimal.ZERO;

    private final PlantMapper plantMapper;

    @Override
    public PlantEnvironmentSnapshotVO getEnvironmentSnapshot(Long plantId) {
        BigDecimal latestTemperature = defaultValue(plantMapper.selectLatestTemperature(plantId));
        BigDecimal earliestTemperature = defaultValue(plantMapper.selectEarliestTemperature(plantId));
        BigDecimal latestHumidity = defaultValue(plantMapper.selectLatestHumidity(plantId));
        BigDecimal earliestHumidity = defaultValue(plantMapper.selectEarliestHumidity(plantId));
        BigDecimal latestLight = defaultValue(plantMapper.selectLatestLight(plantId));
        BigDecimal earliestLight = defaultValue(plantMapper.selectEarliestLight(plantId));

        PlantEnvironmentSnapshotVO snapshot = new PlantEnvironmentSnapshotVO();
        snapshot.setPlantId(plantId);
        snapshot.setTemperature(latestTemperature);
        snapshot.setHumidity(latestHumidity);
        snapshot.setLight(latestLight);
        snapshot.setTempDelta(latestTemperature.subtract(earliestTemperature));
        snapshot.setHumidityDelta(latestHumidity.subtract(earliestHumidity));
        snapshot.setLightDelta(latestLight.subtract(earliestLight));
        return snapshot;
    }

    private BigDecimal defaultValue(BigDecimal value) {
        return value == null ? ZERO : value;
    }
}
