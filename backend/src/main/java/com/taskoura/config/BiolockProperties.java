package com.taskoura.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "biolock")
public class BiolockProperties {

    private boolean enabled = false;
    private String deviceMasterKey = "";
    private int requestTtlSeconds = 120;
    private int accessTtlMinutes = 15;
    private int jobLeaseSeconds = 60;
    private int deviceOnlineSeconds = 30;
    private int maxRequestsPerDocPerHour = 5;
    private int cleanupGraceMinutes = 0;
    private boolean emailOnRequest = true;
    private int emailThrottleMinutes = 5;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getDeviceMasterKey() {
        return deviceMasterKey;
    }

    public void setDeviceMasterKey(String deviceMasterKey) {
        this.deviceMasterKey = deviceMasterKey;
    }

    public int getRequestTtlSeconds() {
        return requestTtlSeconds;
    }

    public void setRequestTtlSeconds(int requestTtlSeconds) {
        this.requestTtlSeconds = requestTtlSeconds;
    }

    public int getAccessTtlMinutes() {
        return accessTtlMinutes;
    }

    public void setAccessTtlMinutes(int accessTtlMinutes) {
        this.accessTtlMinutes = accessTtlMinutes;
    }

    public int getJobLeaseSeconds() {
        return jobLeaseSeconds;
    }

    public void setJobLeaseSeconds(int jobLeaseSeconds) {
        this.jobLeaseSeconds = jobLeaseSeconds;
    }

    public int getDeviceOnlineSeconds() {
        return deviceOnlineSeconds;
    }

    public void setDeviceOnlineSeconds(int deviceOnlineSeconds) {
        this.deviceOnlineSeconds = deviceOnlineSeconds;
    }

    public int getMaxRequestsPerDocPerHour() {
        return maxRequestsPerDocPerHour;
    }

    public void setMaxRequestsPerDocPerHour(int maxRequestsPerDocPerHour) {
        this.maxRequestsPerDocPerHour = maxRequestsPerDocPerHour;
    }

    public int getCleanupGraceMinutes() {
        return cleanupGraceMinutes;
    }

    public void setCleanupGraceMinutes(int cleanupGraceMinutes) {
        this.cleanupGraceMinutes = cleanupGraceMinutes;
    }

    public boolean isEmailOnRequest() {
        return emailOnRequest;
    }

    public void setEmailOnRequest(boolean emailOnRequest) {
        this.emailOnRequest = emailOnRequest;
    }

    public int getEmailThrottleMinutes() {
        return emailThrottleMinutes;
    }

    public void setEmailThrottleMinutes(int emailThrottleMinutes) {
        this.emailThrottleMinutes = emailThrottleMinutes;
    }
}
