package com.devsecops.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;

/**
 * Configures the AI client to call Ollama's /api/generate endpoint directly.
 * This avoids LangChain4j's OllamaChatModel which targets /api/chat — a different
 * endpoint that may not be available on all Ollama-compatible deployments.
 */
@Configuration
public class AiConfig {

    @Value("${langchain4j.ollama.base-url:http://localhost:11434}")
    private String ollamaBaseUrl;

    @Value("${langchain4j.ollama.model-name:gemma4:31b-cloud}")
    private String modelName;

    @Value("${langchain4j.ollama.timeout-minutes:8}")
    private int timeoutMinutes;

    @Bean
    public VulnerabilityAnalysisAI vulnerabilityAnalysisAI(WebClient.Builder builder,
                                                           ObjectMapper objectMapper) {
        WebClient client = builder
            .baseUrl(ollamaBaseUrl)
            .codecs(c -> c.defaultCodecs().maxInMemorySize(10 * 1024 * 1024))
            .build();
        return new OllamaGenerateAI(client, objectMapper, modelName,
                Duration.ofMinutes(timeoutMinutes));
    }
}
