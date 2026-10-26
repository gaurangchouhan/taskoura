package com.taskoura.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.json.JsonTest;
import org.springframework.context.annotation.Import;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@JsonTest
@Import(JacksonConfig.class)
class JacksonConfigTest {

    @Autowired
    private ObjectMapper objectMapper;

    record SampleDto(String name, LocalDateTime timestamp, LocalDate date) {}

    @Test
    @DisplayName("LocalDateTime field serializes with 'Z' and ISO-8601 format globally")
    void localDateTime_serializesWithZ() throws Exception {
        LocalDateTime ldt = LocalDateTime.of(2026, 10, 21, 9, 15, 30, 123_000_000);
        LocalDate date = LocalDate.of(2026, 10, 21);
        SampleDto dto = new SampleDto("Taskoura", ldt, date);

        String json = objectMapper.writeValueAsString(dto);

        // Verify time ends with Z
        assertThat(json).contains("\"timestamp\":\"2026-10-21T09:15:30.123Z\"");
        // Verify date stays YYYY-MM-DD
        assertThat(json).contains("\"date\":\"2026-10-21\"");
    }

    @Test
    @DisplayName("LocalDateTime with zero nanoseconds also serializes with 'Z'")
    void localDateTime_zeroNanos_serializesWithZ() throws Exception {
        LocalDateTime ldt = LocalDateTime.of(2026, 10, 21, 9, 15, 30);
        SampleDto dto = new SampleDto("Taskoura", ldt, null);

        String json = objectMapper.writeValueAsString(dto);

        assertThat(json).contains("\"timestamp\":\"2026-10-21T09:15:30Z\"");
    }

    @Test
    @DisplayName("Deserializing JSON timestamp ending with 'Z' produces correct LocalDateTime in UTC")
    void localDateTime_deserializesWithZ() throws Exception {
        String json = "{\"name\":\"Taskoura\",\"timestamp\":\"2026-10-21T09:15:30.123Z\",\"date\":\"2026-10-21\"}";

        SampleDto dto = objectMapper.readValue(json, SampleDto.class);

        assertThat(dto.timestamp()).isEqualTo(LocalDateTime.of(2026, 10, 21, 9, 15, 30, 123_000_000));
        assertThat(dto.date()).isEqualTo(LocalDate.of(2026, 10, 21));
    }
}
