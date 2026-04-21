package com.plantcloud.control.service.impl;

import com.plantcloud.config.MqttProperties;
import com.plantcloud.control.model.PublishResult;
import com.plantcloud.control.service.MqttPublishService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.springframework.stereotype.Service;

/**
 * Implementation of MQTT publish service.
 * Publishes control messages to MQTT broker with QoS 1 and error handling.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MqttPublishServiceImpl implements MqttPublishService {
    
    private final MqttClient mqttClient;
    private final MqttProperties mqttProperties;
    
    @Override
    public PublishResult publish(String topic, String payload) {
        // Check if MQTT client is connected
        if (mqttClient == null || !mqttClient.isConnected()) {
            log.error("MQTT client is not connected. Cannot publish message to topic: {}", topic);
            return PublishResult.builder()
                    .success(false)
                    .errorMessage("MQTT broker unavailable")
                    .build();
        }
        
        try {
            // Create MQTT message with QoS 1 and retained=false
            MqttMessage message = new MqttMessage(payload.getBytes());
            message.setQos(mqttProperties.getQos());
            message.setRetained(false);
            
            // Publish message
            mqttClient.publish(topic, message);
            
            log.info("Successfully published MQTT message. topic={}, payload={}", 
                    topic, truncatePayload(payload));
            
            return PublishResult.builder()
                    .success(true)
                    .build();
                    
        } catch (MqttException ex) {
            log.error("Failed to publish MQTT message. topic={}, payload={}, error={}", 
                    topic, truncatePayload(payload), ex.getMessage(), ex);
            
            return PublishResult.builder()
                    .success(false)
                    .errorMessage(ex.getMessage())
                    .build();
        }
    }
    
    /**
     * Truncates payload for logging if it exceeds 100 characters.
     */
    private String truncatePayload(String payload) {
        if (payload == null) {
            return "null";
        }
        return payload.length() > 100 ? payload.substring(0, 100) + "..." : payload;
    }
}
