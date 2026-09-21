package com.taskoura.exception;

public class UnauthorizedException extends IllegalStateException {
    public UnauthorizedException(String message) {
        super(message);
    }
}
