package com.plantcloud.mqtt.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Telemetry payload DTO for device/{id}/ia1/telemetry topic.
 * Represents environmental monitoring data from E53_IA1 module.
 */
@Data
public class TelemetryPayload {
    
    /**
     * Temperature in Celsius
     */
    private BigDecimal temperature;
    
    /**
     * Humidity percentage
     */
    private Integer humidity;
    
    /**
     * Light intensity
     */
    @JsonProperty("light_intensity")
    private Integer lightIntensity;
    
    /**
     * Fan status: "ON" or "OFF"
     */
    @JsonProperty("fan_status")
    private String fanStatus;
    
    /**
     * Light status: "ON" or "OFF"
     */
    @JsonProperty("light_status")
    private String lightStatus;
    
    /**
     * Unix timestamp (seconds)
     */
    private Long timestamp;
}
