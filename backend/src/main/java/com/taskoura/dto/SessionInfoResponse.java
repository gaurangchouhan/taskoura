package com.taskoura.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SessionInfoResponse(
        Integer idleTimeoutSeconds,
        Integer warningSeconds,
        String idleExpiresAt,
        String absoluteExpiresAt,
        String serverTime
) {
    public static SessionInfoResponse ofTiming(String idleExpiresAt, String absoluteExpiresAt, String serverTime) {
        return new SessionInfoResponse(null, null, idleExpiresAt, absoluteExpiresAt, serverTime);
    }
}
