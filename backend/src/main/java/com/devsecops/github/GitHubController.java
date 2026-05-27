package com.devsecops.github;

import com.devsecops.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/github")
@RequiredArgsConstructor
public class GitHubController {

    private final GitHubApiService gitHubApiService;

    @GetMapping("/repos")
    public ResponseEntity<List<GitHubApiService.GitHubRepo>> listRepos(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(gitHubApiService.listUserRepos(user));
    }
}
