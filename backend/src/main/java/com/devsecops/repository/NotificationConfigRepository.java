package com.devsecops.repository;

import com.devsecops.model.NotificationConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NotificationConfigRepository extends JpaRepository<NotificationConfig, UUID> {

    @Query("SELECT n FROM NotificationConfig n WHERE n.user.id = :userId AND n.enabled = true")
    List<NotificationConfig> findByUserIdAndEnabledTrue(@Param("userId") UUID userId);

    @Query("SELECT n FROM NotificationConfig n WHERE n.user.id = :userId")
    List<NotificationConfig> findByUserId(@Param("userId") UUID userId);

    @Query("SELECT n FROM NotificationConfig n WHERE n.id = :id AND n.user.id = :userId")
    Optional<NotificationConfig> findByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);

    @Modifying
    @Transactional
    @Query("DELETE FROM NotificationConfig n WHERE n.id = :id AND n.user.id = :userId")
    int deleteByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);
}
