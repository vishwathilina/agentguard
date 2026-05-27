package com.devsecops.repository;

import com.devsecops.model.Scan;
import com.devsecops.model.enums.ScanStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ScanRepository extends JpaRepository<Scan, UUID> {

    Page<Scan> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    List<Scan> findByRepositoryIdOrderByCreatedAtDesc(UUID repositoryId);

    List<Scan> findByStatus(ScanStatus status);

    @Query("SELECT s FROM Scan s WHERE s.user.id = :userId ORDER BY s.createdAt DESC")
    List<Scan> findRecentByUserId(@Param("userId") UUID userId, Pageable pageable);

    @Query("""
        SELECT COUNT(s) FROM Scan s
        WHERE s.user.id = :userId AND s.status = 'COMPLETED'
    """)
    long countCompletedByUserId(@Param("userId") UUID userId);
}
