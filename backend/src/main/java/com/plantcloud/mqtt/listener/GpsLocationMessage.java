package com.plantcloud.mqtt.listener;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class GpsLocationMessage {

    @JsonProperty("plant_id") // 对应硬件 JSON 中的 plant_id
    private Long plantId;
    
    @JsonProperty("longitude")
    private Double longitude;

    @JsonProperty("latitude")
    private Double latitude;

    @JsonProperty("timestamp")
    private Long timestamp;
}
