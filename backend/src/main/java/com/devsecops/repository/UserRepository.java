package com.devsecops.repository;

import com.devsecops.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByGithubId(String githubId);

    Optional<User> findByLogin(String login);

    boolean existsByGithubId(String githubId);
}
