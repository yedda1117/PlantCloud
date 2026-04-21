package com.plantcloud.control.exception;

/**
 * Exception thrown when an invalid command value is provided.
 */
public class InvalidCommandException extends RuntimeException {
    
    public InvalidCommandException(String message) {
        super(message);
    }
}
