package com.taskoura.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.exception.BadGatewayException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@Component
public class GrokClient {

    private static final Logger log = LoggerFactory.getLogger(GrokClient.class);

    @Value("${grok.api.key}")
    private String apiKey;

    @Value("${grok.api.url:https://api.x.ai/v1/chat/completions}")
    private String apiUrl = "https://api.x.ai/v1/chat/completions";

    @Value("${grok.model:grok-beta}")
    private String model = "grok-beta";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @org.springframework.beans.factory.annotation.Autowired
    public GrokClient(RestTemplateBuilder restTemplateBuilder, ObjectMapper objectMapper) {
        this(restTemplateBuilder
                .connectTimeout(Duration.ofSeconds(10))
                .readTimeout(Duration.ofSeconds(30))
                .build(), objectMapper);
    }

    public GrokClient(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public <T> T callGrokJson(String systemPrompt, String userPrompt, Class<T> responseType) {
        String rawResponse = executeChatCompletion(systemPrompt, userPrompt);
        T parsed = tryParseJson(rawResponse, responseType);

        if (parsed != null) {
            return parsed;
        }

        // Retry ONCE with stricter instruction
        log.warn("Failed to parse Grok response as JSON. Retrying with stricter instructions...");
        String retrySystemPrompt = systemPrompt + "\nCRITICAL: You MUST respond with ONLY raw valid JSON matching the schema. Do not output markdown code blocks, backticks, or any other formatting.";
        String retryResponse = executeChatCompletion(retrySystemPrompt, userPrompt);
        parsed = tryParseJson(retryResponse, responseType);

        if (parsed != null) {
            return parsed;
        }

        log.error("Failed to parse Grok JSON after retry. Response was: {}", retryResponse);
        throw new BadGatewayException("AI service unavailable, try again");
    }

    private String executeChatCompletion(String systemPrompt, String userPrompt) {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new BadGatewayException("AI service unavailable, try again");
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey.trim());

            Map<String, Object> requestBody = Map.of(
                    "model", model != null ? model : "grok-beta",
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userPrompt)
                    ),
                    "temperature", 0.2
            );

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    apiUrl != null ? apiUrl : "https://api.x.ai/v1/chat/completions",
                    HttpMethod.POST,
                    entity,
                    String.class
            );

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.error("Grok API returned non-2xx status: {}", response.getStatusCode());
                throw new BadGatewayException("AI service unavailable, try again");
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode choices = root.path("choices");
            if (!choices.isArray() || choices.isEmpty()) {
                throw new BadGatewayException("AI service unavailable, try again");
            }

            return choices.get(0).path("message").path("content").asText();
        } catch (BadGatewayException bge) {
            throw bge;
        } catch (Exception e) {
            log.error("Exception calling Grok API: {}", e.getMessage());
            throw new BadGatewayException("AI service unavailable, try again");
        }
    }

    private <T> T tryParseJson(String content, Class<T> responseType) {
        if (content == null || content.trim().isEmpty()) {
            return null;
        }
        String cleaned = content.trim();
        // Remove markdown code fences if model enclosed JSON in ```json ... ```
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replaceFirst("^```[a-zA-Z]*\\s*", "");
            cleaned = cleaned.replaceFirst("\\s*```$", "");
        }
        try {
            return objectMapper.readValue(cleaned, responseType);
        } catch (Exception e) {
            log.debug("JSON parse attempt failed: {}", e.getMessage());
            return null;
        }
    }
}
