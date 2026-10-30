package com.taskoura.exception;

public class ConflictException extends IllegalStateException {

    private final String code;

    public ConflictException(String message) {
        this("CONFLICT", message);
    }

    public ConflictException(String code, String message) {
        super(message);
        this.code = code != null ? code : "CONFLICT";
    }

    public String getCode() {
        return code;
    }

    public String getErrorCode() {
        return code;
    }
}
