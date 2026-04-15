package com.plantcloud.mqtt.listener;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class SmokeGasAlertMessage {

    @JsonProperty("alert_type")
    private String alertType;

    @JsonProperty("event_type")
    private String eventType;

    @JsonProperty("device_id")
    private String deviceId;

    private BigDecimal value;

    private BigDecimal ppm;

    private String level;

    private String status;

    private Integer alarm;

    private Long timestamp;
}
