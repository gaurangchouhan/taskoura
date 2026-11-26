package com.taskoura.exception;

public class ForbiddenException extends IllegalStateException {

    private final String code;

    public ForbiddenException(String message) {
        this("FORBIDDEN", message);
    }

    public ForbiddenException(String code, String message) {
        super(message);
        this.code = code != null ? code : "FORBIDDEN";
    }

    public String getCode() {
        return code;
    }

    public String getErrorCode() {
        return code;
    }
}
