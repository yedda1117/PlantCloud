package com.plantcloud.control.service;

import com.plantcloud.control.model.PublishResult;

/**
 * Service for publishing MQTT control messages to devices.
 * Encapsulates MQTT client interaction and error handling.
 */
public interface MqttPublishService {
    
    /**
     * Publishes a control message to the specified MQTT topic.
     * 
     * @param topic The MQTT topic (e.g., "device/123/ia1/control")
     * @param payload The JSON payload as a string
     * @return PublishResult containing success status and optional error message
     */
    PublishResult publish(String topic, String payload);
}
