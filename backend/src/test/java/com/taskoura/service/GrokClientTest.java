package com.taskoura.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskoura.dto.AiDtos.GenerateTestCasesResponse;
import com.taskoura.exception.BadGatewayException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class GrokClientTest {

    private RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private ObjectMapper objectMapper;
    private GrokClient grokClient;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        mockServer = MockRestServiceServer.createServer(restTemplate);
        objectMapper = new ObjectMapper();

        grokClient = new GrokClient(restTemplate, objectMapper);
        ReflectionTestUtils.setField(grokClient, "apiKey", "test-grok-api-key");
        ReflectionTestUtils.setField(grokClient, "apiUrl", "https://api.x.ai/v1/chat/completions");
        ReflectionTestUtils.setField(grokClient, "model", "grok-beta");
    }

    @Test
    @DisplayName("callGrokJson parses valid JSON response and strips markdown code blocks")
    void callGrokJson_successWithMarkdownFences() {
        String grokChatResponse = """
                {
                  "choices": [
                    {
                      "message": {
                        "content": "```json\\n{\\"testCases\\": [{\\"title\\": \\"Verify Auth\\", \\"expectedResult\\": \\"200 OK\\"}]}\\n```"
                      }
                    }
                  ]
                }
                """;

        mockServer.expect(requestTo("https://api.x.ai/v1/chat/completions"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer test-grok-api-key"))
                .andRespond(withSuccess(grokChatResponse, MediaType.APPLICATION_JSON));

        GenerateTestCasesResponse response = grokClient.callGrokJson("System", "User", GenerateTestCasesResponse.class);

        mockServer.verify();
        assertThat(response).isNotNull();
        assertThat(response.testCases()).hasSize(1);
        assertThat(response.testCases().get(0).title()).isEqualTo("Verify Auth");
        assertThat(response.testCases().get(0).expectedResult()).isEqualTo("200 OK");
    }

    @Test
    @DisplayName("callGrokJson retries once on malformed JSON and succeeds on retry")
    void callGrokJson_retrySuccess() {
        String badResponse = """
                {
                  "choices": [
                    {
                      "message": {
                        "content": "Here is your JSON: { invalid json ... }"
                      }
                    }
                  ]
                }
                """;

        String goodResponse = """
                {
                  "choices": [
                    {
                      "message": {
                        "content": "{\\"testCases\\": [{\\"title\\": \\"Retried Test\\", \\"expectedResult\\": \\"Passed\\"}]}"
                      }
                    }
                  ]
                }
                """;

        mockServer.expect(requestTo("https://api.x.ai/v1/chat/completions"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(badResponse, MediaType.APPLICATION_JSON));

        mockServer.expect(requestTo("https://api.x.ai/v1/chat/completions"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(goodResponse, MediaType.APPLICATION_JSON));

        GenerateTestCasesResponse response = grokClient.callGrokJson("System", "User", GenerateTestCasesResponse.class);

        mockServer.verify();
        assertThat(response).isNotNull();
        assertThat(response.testCases()).hasSize(1);
        assertThat(response.testCases().get(0).title()).isEqualTo("Retried Test");
    }

    @Test
    @DisplayName("callGrokJson throws BadGatewayException on 500 error from Grok API")
    void callGrokJson_apiError_throwsBadGateway() {
        mockServer.expect(requestTo("https://api.x.ai/v1/chat/completions"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withServerError());

        assertThatThrownBy(() -> grokClient.callGrokJson("System", "User", GenerateTestCasesResponse.class))
                .isInstanceOf(BadGatewayException.class)
                .hasMessage("AI service unavailable, try again");
    }
}
