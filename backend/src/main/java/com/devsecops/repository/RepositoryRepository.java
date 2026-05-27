package com.devsecops.repository;

import com.devsecops.model.Repository;
import com.devsecops.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

@org.springframework.stereotype.Repository
public interface RepositoryRepository extends JpaRepository<Repository, UUID> {

    List<Repository> findByUserOrderByCreatedAtDesc(User user);

    List<Repository> findByUserId(UUID userId);
}
