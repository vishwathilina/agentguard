package com.devsecops.auth;

import com.devsecops.model.User;
import com.devsecops.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jasypt.encryption.StringEncryptor;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class OAuthUserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;
    private final StringEncryptor stringEncryptor;

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(userRequest);

        String githubId  = String.valueOf(oAuth2User.getAttribute("id"));
        String login     = oAuth2User.getAttribute("login");
        String name      = oAuth2User.getAttribute("name");
        String email     = oAuth2User.getAttribute("email");
        String avatarUrl = oAuth2User.getAttribute("avatar_url");
        String rawToken  = userRequest.getAccessToken().getTokenValue();
        String encToken  = stringEncryptor.encrypt(rawToken);

        userRepository.findByGithubId(githubId).ifPresentOrElse(
            existing -> {
                existing.setLogin(login);
                existing.setName(name);
                existing.setEmail(email);
                existing.setAvatarUrl(avatarUrl);
                existing.setAccessTokenEnc(encToken);
                existing.setLastLoginAt(LocalDateTime.now());
                userRepository.save(existing);
                log.info("Updated existing user: {}", login);
            },
            () -> {
                User newUser = User.builder()
                    .githubId(githubId)
                    .login(login)
                    .name(name)
                    .email(email)
                    .avatarUrl(avatarUrl)
                    .accessTokenEnc(encToken)
                    .lastLoginAt(LocalDateTime.now())
                    .build();
                userRepository.save(newUser);
                log.info("Created new user: {}", login);
            }
        );

        return oAuth2User;
    }
}
