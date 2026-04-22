package com.plantcloud.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "app.mqtt")
public class MqttProperties {

    /**
     * MQTT Broker address, for example tcp://localhost:1883.
     */
    private String brokerUrl;

    /**
     * MQTT client id used by the backend service.
     */
    private String clientId = "plantcloud-backend";

    /**
     * Optional username. Leave empty when authentication is disabled.
     */
    private String username;

    /**
     * Optional password. Leave empty when authentication is disabled.
     */
    private String password;

    /**
     * Topic subscribed on startup.
     */
    private String subscribeTopic = "device/+/+/+";

    /**
     * Device status topic subscribed on startup.
     */
    private String statusSubscribeTopic = "device/+/status";

    /**
     * Quality of service for subscription.
     */
    private int qos = 1;

    private boolean automaticReconnect = true;

    private boolean cleanSession = true;

    private int connectionTimeout = 10;

    private int keepAliveInterval = 60;
}
