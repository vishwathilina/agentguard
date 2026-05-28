package com.devsecops.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.Map;

/**
 * Calls Ollama's /api/generate endpoint directly (not /api/chat).
 * Compatible with any Ollama-compatible server including HuggingFace-hosted spaces.
 */
@Slf4j
@RequiredArgsConstructor
public class OllamaGenerateAI implements VulnerabilityAnalysisAI {

    private static final String SYSTEM_SECURITY_EXPERT =
        "You are a senior application security engineer and DevSecOps expert. "
        + "Analyze vulnerability scan results and provide clear, actionable security intelligence. "
        + "Always respond in structured, professional English.";

    private static final String SYSTEM_RISK_SCORER =
        "You are a security risk prioritization engine. "
        + "Score vulnerabilities by actual risk considering exploitability, internet exposure, "
        + "and production relevance. Return only a JSON array.";

    private static final String SYSTEM_EXPLAINER =
        "You are a senior application security engineer. "
        + "Provide a concise human-readable explanation and remediation advice for a single vulnerability. "
        + "Be specific, practical, and developer-friendly.";

    private final WebClient client;
    private final ObjectMapper objectMapper;
    private final String modelName;
    private final Duration timeout;

    @Override
    public String analyzeScan(String vulnsJson, String repoName) {
        String prompt = SYSTEM_SECURITY_EXPERT + "\n\n"
            + "Analyze the following vulnerability scan results and provide:\n"
            + "1. A concise executive summary (2-3 sentences) of the overall security posture.\n"
            + "2. The top 5 most critical risks, each with a risk score (0-10), explanation, and recommended fix.\n"
            + "3. A prioritized findings section in markdown format.\n\n"
            + "Scan results (JSON):\n" + vulnsJson + "\n\n"
            + "Repository: " + repoName;
        return generate(prompt);
    }

    @Override
    public String scoreVulnerabilities(String vulnsJson) {
        String prompt = SYSTEM_RISK_SCORER + "\n\n"
            + "Score each vulnerability on a risk scale of 0.0 to 10.0.\n"
            + "Consider: CVSS score, category (secrets > CVE > IaC > dependency), "
            + "and whether the issue is in a critical path.\n\n"
            + "Vulnerabilities (JSON):\n" + vulnsJson + "\n\n"
            + "Return ONLY a JSON array in this exact format, no other text:\n"
            + "[{\"id\": \"uuid\", \"aiRiskScore\": 8.5}, ...]";
        return generate(prompt);
    }

    @Override
    public String explainVulnerability(String cveId, String title, String component,
                                       String version, String fixedVersion,
                                       String cvssScore, String description) {
        String prompt = SYSTEM_EXPLAINER + "\n\n"
            + "Explain this vulnerability and provide a remediation step:\n\n"
            + "CVE/ID: " + cveId + "\n"
            + "Title: " + title + "\n"
            + "Affected component: " + component + "\n"
            + "Affected version: " + version + "\n"
            + "Fixed version: " + fixedVersion + "\n"
            + "CVSS Score: " + cvssScore + "\n"
            + "Description: " + description + "\n\n"
            + "Respond in two short paragraphs:\n"
            + "1. What this vulnerability means and its real-world impact.\n"
            + "2. How to fix it (specific commands or configuration changes if applicable).";
        return generate(prompt);
    }

    // ── Core generate call ──────────────────────────────────────────────────

    private String generate(String prompt) {
        try {
            Map<String, Object> body = Map.of(
                "model",  modelName,
                "prompt", prompt,
                "stream", false,
                "options", Map.of(
                    "temperature", 0.2,
                    "num_predict", 2048
                )
            );

            String json = client.post()
                .uri("/api/generate")
                .header("Content-Type", "application/json")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(timeout)
                .block();

            if (json == null || json.isBlank()) {
                log.warn("Empty response from Ollama /api/generate");
                return "";
            }

            JsonNode node = objectMapper.readTree(json);
            JsonNode response = node.get("response");
            if (response == null || response.isNull()) {
                log.warn("No 'response' field in Ollama output: {}", json.substring(0, Math.min(200, json.length())));
                return "";
            }
            return response.asText().trim();

        } catch (Exception e) {
            log.error("Ollama /api/generate call failed: {}", e.getMessage());
            throw new RuntimeException("AI model call failed: " + e.getMessage(), e);
        }
    }
}
