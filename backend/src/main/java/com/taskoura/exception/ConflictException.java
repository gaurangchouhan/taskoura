package com.taskoura.exception;

import java.util.Collections;
import java.util.Map;

public class ConflictException extends IllegalStateException {

    private final String code;
    private final Map<String, Object> details;

    public ConflictException(String message) {
        this("CONFLICT", message, Collections.emptyMap());
    }

    public ConflictException(String code, String message) {
        this(code, message, Collections.emptyMap());
    }

    public ConflictException(String code, String message, Map<String, Object> details) {
        super(message);
        this.code = code != null ? code : "CONFLICT";
        this.details = details != null ? details : Collections.emptyMap();
    }

    public String getCode() {
        return code;
    }

    public String getErrorCode() {
        return code;
    }

    public Map<String, Object> getDetails() {
        return details;
    }
}
