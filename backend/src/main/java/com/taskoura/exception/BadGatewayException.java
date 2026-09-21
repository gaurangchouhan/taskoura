package com.taskoura.exception;

public class BadGatewayException extends IllegalStateException {
    public BadGatewayException(String message) {
        super(message);
    }
}
