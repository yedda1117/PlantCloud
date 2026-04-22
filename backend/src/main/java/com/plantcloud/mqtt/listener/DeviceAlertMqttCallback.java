package com.plantcloud.mqtt.listener;

import com.plantcloud.config.MqttProperties;
import com.plantcloud.mqtt.service.MqttMessageHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Slf4j
@Component
@RequiredArgsConstructor
public class DeviceAlertMqttCallback implements MqttCallbackExtended {

    private final MqttProperties mqttProperties;
    private final MqttMessageHandler mqttMessageHandler;

    private volatile MqttClient mqttClient;

    public void setMqttClient(MqttClient mqttClient) {
        this.mqttClient = mqttClient;
    }

    @Override
    public void connectComplete(boolean reconnect, String serverURI) {
        log.info("MQTT connected. reconnect={}, serverURI={}", reconnect, serverURI);
        subscribeDeviceAlertTopic();
    }

    @Override
    public void connectionLost(Throwable cause) {
        log.error("MQTT connection lost.", cause);
    }

    @Override
    public void messageArrived(String topic, MqttMessage message) {
        String payload = new String(message.getPayload(), StandardCharsets.UTF_8);
        log.info("MQTT message arrived. topic={}, qos={}, payload={}", topic, message.getQos(), payload);
        mqttMessageHandler.handleMessage(topic, payload);
    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken token) {
        // Subscriber side does not need delivery callbacks.
    }

    private void subscribeDeviceAlertTopic() {
        if (mqttClient == null || !mqttClient.isConnected()) {
            log.warn("MQTT client is not ready, skip subscription.");
            return;
        }

        try {
            mqttClient.subscribe(
                    new String[]{
                            mqttProperties.getSubscribeTopic(),
                            mqttProperties.getStatusSubscribeTopic()
                    },
                    new int[]{
                            mqttProperties.getQos(),
                            mqttProperties.getQos()
                    }
            );
            log.info("Subscribed MQTT topics={}, {}, qos={}",
                    mqttProperties.getSubscribeTopic(),
                    mqttProperties.getStatusSubscribeTopic(),
                    mqttProperties.getQos());
        } catch (MqttException ex) {
            log.error("Failed to subscribe MQTT topics={}, {}",
                    mqttProperties.getSubscribeTopic(), mqttProperties.getStatusSubscribeTopic(), ex);
            throw new IllegalStateException("Failed to subscribe MQTT topic", ex);
        }
    }
}
