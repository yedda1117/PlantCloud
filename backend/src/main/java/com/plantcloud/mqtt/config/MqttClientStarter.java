package com.plantcloud.mqtt.config;

import com.plantcloud.config.MqttProperties;
import com.plantcloud.mqtt.listener.DeviceAlertMqttCallback;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class MqttClientStarter {

    private final MqttProperties mqttProperties;
    private final MqttConnectOptions mqttConnectOptions;
    private final DeviceAlertMqttCallback deviceAlertMqttCallback;

    private MqttClient mqttClient;

    @PostConstruct
    public void start() {
        try {
            mqttClient = new MqttClient(
                    mqttProperties.getBrokerUrl(),
                    mqttProperties.getClientId(),
                    new MemoryPersistence()
            );
            deviceAlertMqttCallback.setMqttClient(mqttClient);
            mqttClient.setCallback(deviceAlertMqttCallback);
            mqttClient.connect(mqttConnectOptions);
            log.info("MQTT client started. broker={}, clientId={}",
                    mqttProperties.getBrokerUrl(), mqttProperties.getClientId());
        } catch (MqttException ex) {
            throw new IllegalStateException("Failed to start MQTT client", ex);
        }
    }

    @PreDestroy
    public void stop() {
        if (mqttClient == null) {
            return;
        }

        try {
            if (mqttClient.isConnected()) {
                mqttClient.disconnect();
            }
            mqttClient.close();
            log.info("MQTT client stopped.");
        } catch (MqttException ex) {
            log.error("Failed to stop MQTT client cleanly.", ex);
        }
    }
}
