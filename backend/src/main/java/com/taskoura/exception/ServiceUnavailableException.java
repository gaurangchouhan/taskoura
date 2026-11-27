package com.taskoura.exception;

public class ServiceUnavailableException extends RuntimeException {

    private final String code;

    public ServiceUnavailableException(String message) {
        this("SERVICE_UNAVAILABLE", message);
    }

    public ServiceUnavailableException(String code, String message) {
        super(message);
        this.code = code != null ? code : "SERVICE_UNAVAILABLE";
    }

    public String getCode() {
        return code;
    }
}
