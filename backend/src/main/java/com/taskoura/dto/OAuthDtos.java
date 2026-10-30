package com.taskoura.dto;

import java.util.List;

public class OAuthDtos {

    public record OAuthProviderInfo(
            String key,
            String label,
            String startUrl
    ) {}

    public record OAuthProvidersResponse(
            List<OAuthProviderInfo> providers
    ) {}

    public record OAuthExchangeRequest(
            String code
    ) {}

    public record OAuthLinkStartRequest(
            String provider
    ) {}

    public record OAuthLinkStartResponse(
            String url
    ) {}
}

