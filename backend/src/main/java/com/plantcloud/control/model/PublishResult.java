package com.plantcloud.control.model;

import lombok.Builder;
import lombok.Data;

/**
 * Result object for MQTT publish operations.
 * Contains success status and optional error message.
 */
@Data
@Builder
public class PublishResult {
    
    /**
     * Indicates whether the MQTT publish operation succeeded.
     */
    private boolean success;
    
    /**
     * Error message if the publish operation failed.
     * Null if the operation succeeded.
     */
    private String errorMessage;
}
