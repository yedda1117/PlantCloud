package com.plantcloud.mqtt.listener;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class GpsLocationMessage {

    @JsonProperty("longitude")
    private Double longitude;

    @JsonProperty("latitude")
    private Double latitude;

    @JsonProperty("timestamp")
    private Long timestamp;
}
