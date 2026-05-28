package com.devsecops.ws;

import com.devsecops.model.Scan;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScanProgressEmitter {

    private final ScanWebSocketHandler wsHandler;
    private final ObjectMapper objectMapper;

    public void info(String scanId, String message) {
        emit(scanId, "LOG", "INFO", message, null, null);
    }

    public void toolStart(String scanId, String tool) {
        emit(scanId, "TOOL_START", "INFO", "Running " + tool + "…", tool, null);
    }

    public void toolDone(String scanId, String tool, int found) {
        String msg = found == 0
                ? tool + " — no issues found"
                : tool + " — found " + found + " issue(s)";
        emit(scanId, "TOOL_DONE", found > 0 ? "WARN" : "OK", msg, tool, found);
    }

    public void toolError(String scanId, String tool, String reason) {
        emit(scanId, "TOOL_ERROR", "ERROR", tool + " failed: " + reason, tool, null);
    }

    public void complete(String scanId, Scan scan) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type",          "COMPLETE");
        payload.put("level",         "DONE");
        payload.put("message",       "Scan complete — security score: " + scan.getSecurityScore() + "/100");
        payload.put("status",        scan.getStatus().name());
        payload.put("securityScore", scan.getSecurityScore());
        payload.put("totalCritical", scan.getTotalCritical());
        payload.put("totalHigh",     scan.getTotalHigh());
        payload.put("totalMedium",   scan.getTotalMedium());
        payload.put("totalLow",      scan.getTotalLow());
        payload.put("totalInfo",     scan.getTotalInfo());
        payload.put("detectedTechStacks", scan.getDetectedTechStacks());
        payload.put("startedAt",     scan.getStartedAt());
        payload.put("completedAt",   scan.getCompletedAt());
        payload.put("ts",            System.currentTimeMillis());
        send(scanId, payload);
    }

    public void failed(String scanId, String reason) {
        emit(scanId, "FAILED", "ERROR", "Scan failed: " + reason, null, null);
    }

    private void emit(String scanId, String type, String level, String message,
                      String tool, Integer found) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type",    type);
        m.put("level",   level);
        m.put("message", message);
        if (tool  != null) m.put("tool",  tool);
        if (found != null) m.put("found", found);
        m.put("ts", System.currentTimeMillis());
        send(scanId, m);
    }

    private void send(String scanId, Map<String, Object> payload) {
        try {
            wsHandler.broadcast(scanId, objectMapper.writeValueAsString(payload));
        } catch (Exception e) {
            log.warn("Failed to broadcast scan progress: {}", e.getMessage());
        }
    }
}
