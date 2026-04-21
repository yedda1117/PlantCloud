package com.plantcloud.control.exception;

public class MqttPublishException extends RuntimeException {

    public MqttPublishException(String message) {
        super(message);
    }

    public MqttPublishException(String message, Throwable cause) {
        super(message, cause);
    }
}