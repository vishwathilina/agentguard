package com.devsecops.ai;

import com.devsecops.model.AiAnalysis;
import com.devsecops.model.Scan;
import com.devsecops.model.Vulnerability;
import com.devsecops.model.enums.Severity;
import com.devsecops.repository.AiAnalysisRepository;
import com.devsecops.repository.ScanRepository;
import com.devsecops.repository.VulnerabilityRepository;
import org.springframework.data.domain.Pageable;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiAnalysisService {

    private final VulnerabilityAnalysisAI analysisAI;
    private final AiAnalysisRepository aiAnalysisRepository;
    private final ScanRepository scanRepository;
    private final VulnerabilityRepository vulnerabilityRepository;
    private final ObjectMapper objectMapper;

    @Value("${langchain4j.ollama.model-name:gemma4:31b-cloud}")
    private String modelName;

    @Async("aiTaskExecutor")
    @Transactional
    public void analyzeAsync(UUID scanId) {
        Scan scan = scanRepository.findById(scanId).orElse(null);
        if (scan == null) {
            log.warn("Scan {} not found — skipping AI analysis", scanId);
            return;
        }

        List<Vulnerability> vulnerabilities = vulnerabilityRepository
            .findByScanIdOrderByAiRiskScoreDesc(scanId, Pageable.unpaged())
            .getContent();
        if (vulnerabilities.isEmpty()) {
            log.info("No vulnerabilities for scan {} — skipping AI analysis", scanId);
            return;
        }

        // Skip if analysis already exists (idempotent)
        if (aiAnalysisRepository.findByScanId(scanId).isPresent()) {
            log.info("AI analysis already exists for scan {} — skipping", scanId);
            return;
        }

        long startMs = System.currentTimeMillis();
        log.info("Starting AI analysis for scan {} with {} vulnerabilities",
                scanId, vulnerabilities.size());

        try {
            // Take top 30 by severity for analysis prompt
            List<Vulnerability> topVulns = vulnerabilities.stream()
                .sorted(Comparator.comparing(v -> v.getSeverity().ordinal()))
                .limit(30)
                .toList();

            String repoName = scan.getRepository().getTargetType().name().equals("GIT_REPO")
                ? scan.getRepository().getGithubRepoFullName()
                : scan.getRepository().getDockerImage();

            String vulnsJson = buildVulnsJson(topVulns);

            // Step 1 — executive summary + prioritized findings
            String scanAnalysis = analysisAI.analyzeScan(vulnsJson, repoName);
            String[] parts = splitAnalysis(scanAnalysis);

            // Step 2 — AI risk scores for all vulns
            String scoresJson = analysisAI.scoreVulnerabilities(vulnsJson);
            applyRiskScores(scoresJson, vulnerabilities);

            // Step 3 — per-vulnerability AI explanation for top critical/high (up to 5)
            enrichTopVulnerabilitiesWithExplanations(vulnerabilities);

            List<Map<String, Object>> topRisks = buildTopRisks(vulnerabilities);

            AiAnalysis analysis = AiAnalysis.builder()
                .scan(scan)
                .executiveSummary(parts[0])
                .prioritizedFindingsMd(parts[1])
                .topRisks(topRisks)
                .processingTimeMs((int)(System.currentTimeMillis() - startMs))
                .modelUsed(modelName)
                .build();

            aiAnalysisRepository.save(analysis);
            log.info("AI analysis completed for scan {} in {}ms",
                    scan.getId(), System.currentTimeMillis() - startMs);

        } catch (Exception e) {
            log.error("AI analysis failed for scan {}: {}", scan.getId(), e.getMessage(), e);
        }
    }

    @Cacheable(value = "ai-analysis", key = "#scanId", unless = "#result == null")
    public Optional<AiAnalysis> getCached(UUID scanId) {
        return aiAnalysisRepository.findByScanId(scanId);
    }

    // ── Private helpers ────────────────────────────────────────────────────

    private String buildVulnsJson(List<Vulnerability> vulns) throws Exception {
        return objectMapper.writeValueAsString(vulns.stream().map(v -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",        v.getId().toString());
            m.put("cveId",     v.getCveId() != null ? v.getCveId() : "");
            m.put("title",     v.getTitle());
            m.put("severity",  v.getSeverity().name());
            m.put("category",  v.getCategory().name());
            m.put("component", v.getAffectedComponent() != null ? v.getAffectedComponent() : "");
            m.put("version",   v.getAffectedVersion()   != null ? v.getAffectedVersion()   : "");
            m.put("cvssScore", v.getCvssScore() != null ? v.getCvssScore().toString() : "N/A");
            return m;
        }).toList());
    }

    private String[] splitAnalysis(String raw) {
        if (raw == null || raw.isBlank()) {
            return new String[]{"AI analysis completed.", ""};
        }
        // First ~500 chars as executive summary, full text as prioritized findings
        String summary = raw.length() > 600 ? raw.substring(0, 597) + "…" : raw;
        return new String[]{summary, raw};
    }

    private void applyRiskScores(String scoresJson, List<Vulnerability> vulnerabilities) {
        try {
            List<Map<String, Object>> scores = objectMapper.readValue(
                scoresJson, new TypeReference<>() {});
            Map<String, BigDecimal> scoreMap = new HashMap<>();
            for (Map<String, Object> s : scores) {
                String id    = (String) s.get("id");
                Object score = s.get("aiRiskScore");
                if (id != null && score != null) {
                    scoreMap.put(id, new BigDecimal(score.toString()));
                }
            }
            List<Vulnerability> toSave = new ArrayList<>();
            for (Vulnerability v : vulnerabilities) {
                BigDecimal score = scoreMap.get(v.getId().toString());
                if (score != null) {
                    v.setAiRiskScore(score);
                    toSave.add(v);
                }
            }
            if (!toSave.isEmpty()) {
                vulnerabilityRepository.saveAll(toSave);
            }
        } catch (Exception e) {
            log.warn("Failed to parse/apply AI risk scores: {}", e.getMessage());
        }
    }

    private void enrichTopVulnerabilitiesWithExplanations(List<Vulnerability> vulnerabilities) {
        List<Vulnerability> targets = vulnerabilities.stream()
            .filter(v -> v.getSeverity() == Severity.CRITICAL || v.getSeverity() == Severity.HIGH)
            .filter(v -> v.getAiExplanation() == null)
            .sorted(Comparator.comparing((Vulnerability v) -> v.getSeverity().ordinal())
                .thenComparing(Comparator.comparing(
                    (Vulnerability v) -> v.getAiRiskScore() != null ? v.getAiRiskScore() : BigDecimal.ZERO
                ).reversed()))
            .limit(5)
            .toList();

        List<Vulnerability> enriched = new ArrayList<>();
        for (Vulnerability v : targets) {
            try {
                String explanation = analysisAI.explainVulnerability(
                    v.getCveId()             != null ? v.getCveId()             : "N/A",
                    v.getTitle(),
                    v.getAffectedComponent() != null ? v.getAffectedComponent() : "N/A",
                    v.getAffectedVersion()   != null ? v.getAffectedVersion()   : "N/A",
                    v.getFixedVersion()      != null ? v.getFixedVersion()       : "N/A",
                    v.getCvssScore()         != null ? v.getCvssScore().toString() : "N/A",
                    v.getDescription()       != null ? v.getDescription()        : ""
                );
                // Split into explanation + remediation at a blank line or paragraph boundary
                String[] halves = splitExplanationRemediation(explanation);
                v.setAiExplanation(halves[0]);
                v.setAiRemediation(halves[1]);
                enriched.add(v);
                log.debug("Enriched vuln {} with AI explanation", v.getId());
            } catch (Exception e) {
                log.warn("Failed to explain vuln {}: {}", v.getId(), e.getMessage());
            }
        }
        if (!enriched.isEmpty()) {
            vulnerabilityRepository.saveAll(enriched);
        }
    }

    private String[] splitExplanationRemediation(String raw) {
        if (raw == null || raw.isBlank()) return new String[]{"", ""};
        // Try to split on paragraph break between explanation and remediation
        String[] paragraphs = raw.split("\n\n", 2);
        if (paragraphs.length == 2) {
            return new String[]{paragraphs[0].trim(), paragraphs[1].trim()};
        }
        // Fallback: split at midpoint
        int mid = raw.length() / 2;
        int nl  = raw.indexOf('\n', mid);
        if (nl > 0) {
            return new String[]{raw.substring(0, nl).trim(), raw.substring(nl).trim()};
        }
        return new String[]{raw.trim(), ""};
    }

    private List<Map<String, Object>> buildTopRisks(List<Vulnerability> vulnerabilities) {
        return vulnerabilities.stream()
            .filter(v -> v.getAiRiskScore() != null)
            .sorted(Comparator.comparing(Vulnerability::getAiRiskScore).reversed())
            .limit(5)
            .map(v -> {
                Map<String, Object> risk = new LinkedHashMap<>();
                risk.put("title",       v.getTitle());
                risk.put("severity",    v.getSeverity().name());
                risk.put("aiRiskScore", v.getAiRiskScore());
                risk.put("cveId",       v.getCveId() != null ? v.getCveId() : "");
                return risk;
            })
            .collect(java.util.stream.Collectors.toList());
    }
}
