package com.plantcloud.control.exception;

import com.plantcloud.common.enums.ResultCode;
import com.plantcloud.common.result.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Global exception handler for control module.
 */
@Slf4j
@RestControllerAdvice
public class ControlExceptionHandler {

    /**
     * Device not found → 404
     */
    @ExceptionHandler(DeviceNotFoundException.class)
    public Result<Void> handleDeviceNotFound(DeviceNotFoundException ex) {
        log.warn("Device not found: {}", ex.getMessage());
        return Result.fail(ResultCode.NOT_FOUND.getCode(), ex.getMessage());
    }

    /**
     * Invalid command → 400
     */
    @ExceptionHandler(InvalidCommandException.class)
    public Result<Void> handleInvalidCommand(InvalidCommandException ex) {
        log.warn("Invalid command: {}", ex.getMessage());
        return Result.fail(ResultCode.BAD_REQUEST.getCode(), ex.getMessage());
    }

    /**
     * MQTT publish failed → 500
     */
    @ExceptionHandler(MqttPublishException.class)
    public Result<Void> handleMqttPublish(MqttPublishException ex) {
        log.error("MQTT publish failed: {}", ex.getMessage(), ex);
        return Result.fail(ResultCode.MQTT_PUBLISH_FAILED.getCode(), ex.getMessage());
    }
}