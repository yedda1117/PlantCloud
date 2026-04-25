package com.plantcloud.control.service.impl;

import com.plantcloud.config.MqttProperties;
import com.plantcloud.control.model.PublishResult;
import com.plantcloud.control.service.MqttPublishService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Implementation of MQTT publish service.
 * Uses a connection pool to maintain persistent MQTT connections for publishing control messages.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MqttPublishServiceImpl implements MqttPublishService {
    
    private final MqttProperties mqttProperties;
    
    // Connection pool: key is broker URL, value is MQTT client
    private final ConcurrentMap<String, MqttClient> connectionPool = new ConcurrentHashMap<>();
    
    @Override
    public PublishResult publish(String topic, String payload) {
        try {
            publishWithPooledClient(topic, payload);

            log.info("Successfully published MQTT message. topic={}, payload={}",
                    topic, truncatePayload(payload));

            return PublishResult.builder()
                    .success(true)
                    .build();

        } catch (Exception ex) {
            log.warn("MQTT publish failed with pooled client, will retry with new client. topic={}, payload={}, error={}",
                    topic, truncatePayload(payload), ex.getMessage(), ex);
            return publishWithFallbackClient(topic, payload, ex);
        }
    }

    private PublishResult publishWithFallbackClient(String topic, String payload, Exception pooledEx) {
        try {
            // Fallback to dedicated client if pooled client fails
            publishWithDedicatedClient(topic, payload);

            log.info("Successfully published MQTT message after fallback. topic={}, payload={}",
                    topic, truncatePayload(payload));

            return PublishResult.builder()
                    .success(true)
                    .build();
        } catch (MqttException retryEx) {
            String errorMessage = describeMqttException(retryEx);
            if (pooledEx != null && StringUtils.hasText(pooledEx.getMessage())) {
                errorMessage = "pooled=" + pooledEx.getMessage() + "; fallback=" + errorMessage;
            }
            log.error("Failed to publish MQTT message after fallback. topic={}, payload={}, reasonCode={}, error={}",
                    topic, truncatePayload(payload), retryEx.getReasonCode(), retryEx.getMessage(), retryEx);

            return PublishResult.builder()
                    .success(false)
                    .errorMessage(errorMessage)
                    .build();
        }
    }

    private void publishWithPooledClient(String topic, String payload) throws MqttException {
        String brokerUrl = mqttProperties.getBrokerUrl();
        MqttClient mqttClient = connectionPool.computeIfAbsent(brokerUrl, this::createPooledClient);
        
        // Ensure connection is alive
        if (!mqttClient.isConnected()) {
            synchronized (mqttClient) {
                if (!mqttClient.isConnected()) {
                    log.info("[CTRL] pooled mqtt reconnect start broker={} clientId={}", brokerUrl, mqttClient.getClientId());
                    mqttClient.connect(buildConnectOptions());
                    log.info("[CTRL] pooled mqtt reconnect success broker={} clientId={}", brokerUrl, mqttClient.getClientId());
                }
            }
        }
        
        log.info("[CTRL] mqtt publish start topic={} payload={} clientId={}", topic, payload, mqttClient.getClientId());
        publishWithClient(mqttClient, topic, payload);
        log.info("[CTRL] mqtt publish success topic={} payload={} clientId={}", topic, payload, mqttClient.getClientId());
    }

    private MqttClient createPooledClient(String brokerUrl) {
        try {
            String clientId = buildPooledClientId();
            MqttClient mqttClient = new MqttClient(brokerUrl, clientId, new MemoryPersistence());
            
            log.info("[CTRL] creating pooled mqtt client broker={} clientId={}", brokerUrl, clientId);
            mqttClient.connect(buildConnectOptions());
            log.info("[CTRL] pooled mqtt client connected broker={} clientId={}", brokerUrl, clientId);
            
            return mqttClient;
        } catch (MqttException ex) {
            throw new RuntimeException("Failed to create pooled MQTT client for " + brokerUrl, ex);
        }
    }

    private void publishWithDedicatedClient(String topic, String payload) throws MqttException {
        String clientId = buildPublisherClientId();
        MqttClient mqttClient = new MqttClient(
                mqttProperties.getBrokerUrl(),
                clientId,
                new MemoryPersistence()
        );

        try {
            log.info("[CTRL] fallback mqtt connect start broker={} clientId={}", mqttProperties.getBrokerUrl(), clientId);
            mqttClient.connect(buildConnectOptions());
            log.info("[CTRL] fallback mqtt connect success broker={} clientId={}", mqttProperties.getBrokerUrl(), clientId);
            log.info("[CTRL] fallback mqtt publish start topic={} payload={}", topic, payload);
            publishWithClient(mqttClient, topic, payload);
            log.info("[CTRL] fallback mqtt publish success topic={} payload={}", topic, payload);
        } finally {
            closePublisherClient(mqttClient);
        }
    }

    private void publishWithClient(MqttClient mqttClient, String topic, String payload) throws MqttException {
        MqttMessage message = new MqttMessage(payload.getBytes(StandardCharsets.UTF_8));
        message.setQos(mqttProperties.getQos());
        message.setRetained(false);
        mqttClient.publish(topic, message);
    }

    private MqttConnectOptions buildConnectOptions() {
        MqttConnectOptions options = new MqttConnectOptions();
        options.setAutomaticReconnect(true); // Enable auto-reconnect for pooled clients
        options.setCleanSession(false); // Keep session for better reliability
        options.setMqttVersion(MqttConnectOptions.MQTT_VERSION_3_1_1);
        options.setConnectionTimeout(mqttProperties.getConnectionTimeout());
        options.setKeepAliveInterval(mqttProperties.getKeepAliveInterval());

        if (StringUtils.hasText(mqttProperties.getUsername())) {
            options.setUserName(mqttProperties.getUsername());
        }
        if (StringUtils.hasText(mqttProperties.getPassword())) {
            options.setPassword(mqttProperties.getPassword().toCharArray());
        }
        return options;
    }

    private String buildPooledClientId() {
        return "pc-ctrl-pooled-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }

    private String buildPublisherClientId() {
        return "pc-ctrl-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }

    private void closePublisherClient(MqttClient mqttClient) {
        try {
            if (mqttClient.isConnected()) {
                mqttClient.disconnect();
            }
        } catch (MqttException ex) {
            log.warn("Failed to disconnect MQTT publisher client. reasonCode={}, error={}",
                    ex.getReasonCode(), ex.getMessage());
        }

        try {
            mqttClient.close(true);
        } catch (MqttException ex) {
            log.warn("Failed to close MQTT publisher client. reasonCode={}, error={}",
                    ex.getReasonCode(), ex.getMessage());
        }
    }

    private String describeMqttException(MqttException ex) {
        String message = ex.getMessage();
        if (!StringUtils.hasText(message) || "MqttException".equals(message)) {
            message = "reasonCode=" + ex.getReasonCode();
        } else {
            message = message + ", reasonCode=" + ex.getReasonCode();
        }

        Throwable cause = ex.getCause();
        if (cause != null && StringUtils.hasText(cause.getMessage())) {
            message = message + ", cause=" + cause.getMessage();
        }

        return message;
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
