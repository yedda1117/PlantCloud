package com.plantcloud.control.exception;

/**
 * Exception thrown when a device is not found in the database.
 */
public class DeviceNotFoundException extends RuntimeException {
    
    public DeviceNotFoundException(String message) {
        super(message);
    }
}
