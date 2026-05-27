package com.devsecops.auth;

import com.devsecops.model.User;
import com.devsecops.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jasypt.encryption.StringEncryptor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class GithubTokenAuthFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;
    private final StringEncryptor stringEncryptor;

    /** Simple token → User cache, avoids calling GitHub on every request. TTL ~10 min. */
    private final ConcurrentHashMap<String, CachedAuth> tokenCache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = 10 * 60 * 1000L;

    private record CachedAuth(User user, long expiresAt) {}

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        String token = header.substring(7);

        try {
            User user = resolveUser(token);
            var auth = new UsernamePasswordAuthenticationToken(
                    user, token, List.of(new SimpleGrantedAuthority("ROLE_USER")));
            SecurityContextHolder.getContext().setAuthentication(auth);
        } catch (Exception e) {
            log.warn("GitHub token validation failed: {}", e.getMessage());
        }

        chain.doFilter(request, response);
    }

    @SuppressWarnings("unchecked")
    private User resolveUser(String token) {
        long now = System.currentTimeMillis();

        CachedAuth cached = tokenCache.get(token);
        if (cached != null && cached.expiresAt() > now) {
            return cached.user();
        }

        RestTemplate restTemplate = new RestTemplate();
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        headers.set(HttpHeaders.ACCEPT, "application/json");

        @SuppressWarnings("rawtypes")
        ResponseEntity<Map> resp = restTemplate.exchange(
                "https://api.github.com/user",
                org.springframework.http.HttpMethod.GET,
                new org.springframework.http.HttpEntity<>(headers),
                Map.class
        );

        if (resp.getStatusCode() != HttpStatus.OK || resp.getBody() == null) {
            throw new RuntimeException("GitHub rejected token");
        }

        Map<String, Object> info = resp.getBody();
        String githubId  = String.valueOf(info.get("id"));
        String login     = (String) info.get("login");
        String name      = (String) info.get("name");
        String email     = (String) info.get("email");
        String avatarUrl = (String) info.get("avatar_url");
        String encToken  = stringEncryptor.encrypt(token);

        User user = userRepository.findByGithubId(githubId).map(existing -> {
            existing.setLogin(login);
            existing.setName(name);
            existing.setEmail(email);
            existing.setAvatarUrl(avatarUrl);
            existing.setAccessTokenEnc(encToken);
            existing.setLastLoginAt(LocalDateTime.now());
            return userRepository.save(existing);
        }).orElseGet(() -> {
            User newUser = User.builder()
                    .githubId(githubId)
                    .login(login)
                    .name(name)
                    .email(email)
                    .avatarUrl(avatarUrl)
                    .accessTokenEnc(encToken)
                    .lastLoginAt(LocalDateTime.now())
                    .build();
            return userRepository.save(newUser);
        });

        tokenCache.put(token, new CachedAuth(user, now + CACHE_TTL_MS));
        log.info("Authenticated via GitHub token: {}", login);
        return user;
    }
}
