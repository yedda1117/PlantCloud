package com.plantcloud.plant.vo;

import lombok.Data;

import java.util.List;

@Data
public class PlantPredictionAiVO {

    private String summary;
    private List<String> advice;
    private List<String> riskWarnings;
}
