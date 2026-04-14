package com.plantcloud.mqtt.listener;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class TiltAlertMessage {

    @JsonProperty("alert_type")
    private String alertType;

    @JsonProperty("is_tilt")
    private Boolean isTilt;

    private Long timestamp;
}
