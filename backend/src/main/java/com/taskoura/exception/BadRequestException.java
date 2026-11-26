package com.taskoura.exception;

public class BadRequestException extends IllegalStateException {
    private final String code;

    public BadRequestException(String message) {
        this("VALIDATION_FAILED", message);
    }

    public BadRequestException(String code, String message) {
        super(message);
        this.code = code != null ? code : "VALIDATION_FAILED";
    }

    public String getCode() {
        return code;
    }
}
