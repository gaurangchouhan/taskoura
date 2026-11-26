package com.taskoura.exception;

public class RateLimitedException extends RuntimeException {
    private final String code;
    private final int retryAfterSeconds;

    public RateLimitedException(String message, int retryAfterSeconds) {
        this("RATE_LIMITED", message, retryAfterSeconds);
    }

    public RateLimitedException(String code, String message, int retryAfterSeconds) {
        super(message);
        this.code = code != null ? code : "RATE_LIMITED";
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public String getCode() {
        return code;
    }

    public int getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
