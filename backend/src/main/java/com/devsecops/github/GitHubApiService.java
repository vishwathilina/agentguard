package com.devsecops.github;

import com.devsecops.model.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jasypt.encryption.StringEncryptor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class GitHubApiService {

    private final StringEncryptor stringEncryptor;
    private static final int PAGE_SIZE = 100;
    private static final int MAX_PAGES = 10;

    /**
     * Returns all repos (own + org member) visible to the user, paginated internally.
     */
    public List<GitHubRepo> listUserRepos(User user) {
        String token = stringEncryptor.decrypt(user.getAccessTokenEnc());
        RestTemplate rest = new RestTemplate();

        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        headers.set(HttpHeaders.ACCEPT, "application/vnd.github+json");
        headers.set("X-GitHub-Api-Version", "2022-11-28");
        var entity = new org.springframework.http.HttpEntity<Void>(headers);

        List<GitHubRepo> all = new ArrayList<>();

        for (int page = 1; page <= MAX_PAGES; page++) {
            String url = UriComponentsBuilder
                    .fromHttpUrl("https://api.github.com/user/repos")
                    .queryParam("per_page", PAGE_SIZE)
                    .queryParam("page", page)
                    .queryParam("sort", "pushed")
                    .queryParam("affiliation", "owner,collaborator,organization_member")
                    .toUriString();

            ResponseEntity<List<Map<String, Object>>> resp = rest.exchange(
                    url, HttpMethod.GET, entity,
                    new ParameterizedTypeReference<>() {});

            List<Map<String, Object>> body = resp.getBody();
            if (body == null || body.isEmpty()) break;

            for (Map<String, Object> r : body) {
                all.add(GitHubRepo.fromMap(r));
            }

            if (body.size() < PAGE_SIZE) break;
        }

        log.debug("Fetched {} repos for user {}", all.size(), user.getLogin());
        return all;
    }

    public record GitHubRepo(
            long id,
            String fullName,
            String description,
            String defaultBranch,
            boolean isPrivate,
            String language,
            int stargazersCount,
            String pushedAt,
            String htmlUrl
    ) {
        @SuppressWarnings("unchecked")
        static GitHubRepo fromMap(Map<String, Object> m) {
            return new GitHubRepo(
                    ((Number) m.get("id")).longValue(),
                    (String) m.get("full_name"),
                    (String) m.get("description"),
                    m.getOrDefault("default_branch", "main").toString(),
                    Boolean.TRUE.equals(m.get("private")),
                    (String) m.get("language"),
                    m.get("stargazers_count") != null ? ((Number) m.get("stargazers_count")).intValue() : 0,
                    (String) m.get("pushed_at"),
                    (String) m.get("html_url")
            );
        }
    }
}
