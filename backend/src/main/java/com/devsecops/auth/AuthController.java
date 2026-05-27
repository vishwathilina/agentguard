package com.devsecops.auth;

import com.devsecops.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(@AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of(
            "id",        user.getId(),
            "login",     user.getLogin(),
            "name",      user.getName()      != null ? user.getName()      : "",
            "email",     user.getEmail()     != null ? user.getEmail()     : "",
            "avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : ""
        ));
    }
}
