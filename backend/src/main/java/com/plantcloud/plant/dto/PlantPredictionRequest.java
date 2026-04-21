package com.plantcloud.plant.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class PlantPredictionRequest {

    @JsonProperty("plant_type")
    private String plantType;

    private Double temp;
    private Double humidity;
    private Double light;

    @JsonProperty("temp_diff_1h")
    private Double tempDiff1h;

    @JsonProperty("humidity_diff_1h")
    private Double humidityDiff1h;

    @JsonProperty("light_diff_1h")
    private Double lightDiff1h;

    @JsonProperty("abnormal_duration")
    private Double abnormalDuration;
}
