package com.plantcloud.plant.dto;

import lombok.Data;

@Data
public class PlantPredictionResponse {

    private Boolean success;
    private PlantPredictionResultDTO data;
    private String message;

    @Data
    public static class PlantPredictionResultDTO {
        private String status;
        private String trend;
    }
}
