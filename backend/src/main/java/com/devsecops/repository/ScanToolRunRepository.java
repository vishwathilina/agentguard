package com.devsecops.repository;

import com.devsecops.model.ScanToolRun;
import com.devsecops.model.enums.ToolName;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ScanToolRunRepository extends JpaRepository<ScanToolRun, UUID> {

    List<ScanToolRun> findByScanId(UUID scanId);

    Optional<ScanToolRun> findByScanIdAndToolName(UUID scanId, ToolName toolName);
}
