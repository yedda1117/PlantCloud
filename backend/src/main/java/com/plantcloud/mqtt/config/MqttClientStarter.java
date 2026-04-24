package com.plantcloud.mqtt.config;

import com.plantcloud.config.MqttProperties;
import com.plantcloud.mqtt.listener.DeviceAlertMqttCallback;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.springframework.context.annotation.Bean;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class MqttClientStarter {

    private final MqttProperties mqttProperties;
    private final MqttConnectOptions mqttConnectOptions;
    private final DeviceAlertMqttCallback deviceAlertMqttCallback;

    @Getter
    private MqttClient mqttClient;

    @PostConstruct
    public void start() {
        try {
            ensureConnected();
            log.info("MQTT client started. broker={}, clientId={}",
                    mqttProperties.getBrokerUrl(), mqttProperties.getClientId());
        } catch (MqttException ex) {
            log.error("MQTT client startup skipped because broker is unavailable. broker={}, clientId={}",
                    mqttProperties.getBrokerUrl(), mqttProperties.getClientId(), ex);
        }
    }

    public synchronized MqttClient ensureConnected() throws MqttException {
        if (mqttClient == null) {
            mqttClient = createMqttClient();
        }

        if (!mqttClient.isConnected()) {
            log.warn("MQTT client is disconnected, trying to connect. broker={}, clientId={}",
                    mqttProperties.getBrokerUrl(), mqttProperties.getClientId());
            try {
                mqttClient.connect(mqttConnectOptions);
            } catch (MqttException ex) {
                log.warn("MQTT client connect failed, will recreate client. broker={}, clientId={}, reasonCode={}, error={}",
                        mqttProperties.getBrokerUrl(), mqttProperties.getClientId(), ex.getReasonCode(), ex.getMessage());
                closeClientQuietly(mqttClient);
                mqttClient = createMqttClient();
                mqttClient.connect(mqttConnectOptions);
            }
            log.info("MQTT client connected. broker={}, clientId={}",
                    mqttProperties.getBrokerUrl(), mqttProperties.getClientId());
        }

        return mqttClient;
    }

    public synchronized MqttClient reconnect() throws MqttException {
        closeClientQuietly(mqttClient);
        mqttClient = createMqttClient();
        mqttClient.connect(mqttConnectOptions);
        log.info("MQTT client reconnected. broker={}, clientId={}",
                mqttProperties.getBrokerUrl(), mqttProperties.getClientId());
        return mqttClient;
    }

    private MqttClient createMqttClient() throws MqttException {
        MqttClient client = new MqttClient(
                mqttProperties.getBrokerUrl(),
                mqttProperties.getClientId(),
                new MemoryPersistence()
        );
        deviceAlertMqttCallback.setMqttClient(client);
        client.setCallback(deviceAlertMqttCallback);
        return client;
    }

    private void closeClientQuietly(MqttClient client) {
        if (client == null) {
            return;
        }

        try {
            if (client.isConnected()) {
                client.disconnect();
            }
        } catch (MqttException ex) {
            log.warn("Failed to disconnect MQTT client before reconnect. reasonCode={}, error={}",
                    ex.getReasonCode(), ex.getMessage());
        }

        try {
            client.close(true);
        } catch (MqttException ex) {
            log.warn("Failed to close MQTT client before reconnect. reasonCode={}, error={}",
                    ex.getReasonCode(), ex.getMessage());
        }
    }

    @Bean
    public MqttClient mqttClient() {
        return mqttClient;
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
