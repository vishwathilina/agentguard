package com.devsecops.ws;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.net.URI;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class ScanWebSocketHandler extends TextWebSocketHandler {

    /** scanId → connected browser sessions */
    private final ConcurrentHashMap<String, Set<WebSocketSession>> sessions =
            new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String scanId = extractScanId(session.getUri());
        sessions.computeIfAbsent(scanId, k -> ConcurrentHashMap.newKeySet()).add(session);
        log.debug("WS connected: scan={} session={}", scanId, session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String scanId = extractScanId(session.getUri());
        Set<WebSocketSession> set = sessions.get(scanId);
        if (set != null) set.remove(session);
        log.debug("WS closed: scan={} status={}", scanId, status);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("WS transport error: {}", exception.getMessage());
    }

    /** Broadcast a JSON string to every browser watching this scan. */
    public void broadcast(String scanId, String jsonPayload) {
        Set<WebSocketSession> set = sessions.getOrDefault(scanId, Set.of());
        for (WebSocketSession session : set) {
            try {
                if (session.isOpen()) {
                    session.sendMessage(new TextMessage(jsonPayload));
                }
            } catch (Exception e) {
                log.warn("Failed to send WS message to session {}: {}", session.getId(), e.getMessage());
            }
        }
    }

    private String extractScanId(URI uri) {
        String path = uri.getPath();
        return path.substring(path.lastIndexOf('/') + 1);
    }
}
