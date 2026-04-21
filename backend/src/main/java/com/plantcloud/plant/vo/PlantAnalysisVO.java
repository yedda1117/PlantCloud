package com.plantcloud.plant.vo;

import lombok.Data;

import java.util.List;

@Data
public class PlantAnalysisVO {

    private Long plantId;
    private String plantName;
    private String species;
    private String status;
    private String trend;
    private String summary;
    private List<String> advice;
    private List<String> riskWarnings;
}
