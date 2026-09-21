package com.taskoura.exception;

public class ForbiddenException extends IllegalStateException {
    public ForbiddenException(String message) {
        super(message);
    }
}
