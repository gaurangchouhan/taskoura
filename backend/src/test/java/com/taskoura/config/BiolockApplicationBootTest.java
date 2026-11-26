package com.taskoura.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

public class BiolockApplicationBootTest {

    @Nested
    @SpringBootTest
    @ActiveProfiles("test")
    @TestPropertySource(properties = {
            "biolock.enabled=false",
            "biolock.device-master-key="
    })
    class BiolockDisabledBootTest {

        @Autowired
        private ApplicationContext context;

        @Value("${biolock.enabled:false}")
        private boolean biolockEnabled;

        @Test
        @DisplayName("Application boots cleanly when biolock.enabled=false and master key is empty")
        void testAppBootsWithBiolockDisabled() {
            assertThat(context).isNotNull();
            assertThat(biolockEnabled).isFalse();
        }
    }

    @Nested
    @SpringBootTest
    @ActiveProfiles("test")
    @TestPropertySource(properties = {
            "biolock.enabled=true",
            "biolock.device-master-key=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
    })
    class BiolockEnabledBootTest {

        @Autowired
        private ApplicationContext context;

        @Value("${biolock.enabled:false}")
        private boolean biolockEnabled;

        @Value("${biolock.device-master-key}")
        private String masterKey;

        @Test
        @DisplayName("Application boots cleanly when biolock.enabled=true and valid master key is provided")
        void testAppBootsWithBiolockEnabled() {
            assertThat(context).isNotNull();
            assertThat(biolockEnabled).isTrue();
            assertThat(masterKey).isNotBlank();
        }
    }
}
