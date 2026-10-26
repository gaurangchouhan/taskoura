package com.taskoura.exception;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public class ValidationException extends RuntimeException {

    private final Map<String, String> fieldErrors;

    public ValidationException(String message) {
        super(message);
        this.fieldErrors = Collections.emptyMap();
    }

    public ValidationException(Map<String, String> fieldErrors) {
        super(fieldErrors != null && !fieldErrors.isEmpty()
                ? fieldErrors.values().iterator().next()
                : "Validation failed");
        this.fieldErrors = fieldErrors != null ? Collections.unmodifiableMap(new LinkedHashMap<>(fieldErrors)) : Collections.emptyMap();
    }

    public ValidationException(String message, Map<String, String> fieldErrors) {
        super(message != null ? message : (fieldErrors != null && !fieldErrors.isEmpty()
                ? fieldErrors.values().iterator().next()
                : "Validation failed"));
        this.fieldErrors = fieldErrors != null ? Collections.unmodifiableMap(new LinkedHashMap<>(fieldErrors)) : Collections.emptyMap();
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
