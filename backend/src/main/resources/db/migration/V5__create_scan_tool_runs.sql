CREATE TABLE scan_tool_runs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id       UUID         NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    tool_name     VARCHAR(50)  NOT NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    raw_output    TEXT,
    error_message TEXT,
    duration_ms   INT,
    started_at    TIMESTAMP,
    completed_at  TIMESTAMP,

    CONSTRAINT chk_tool_name CHECK (
        tool_name IN ('TRIVY','GITLEAKS','TFSEC','KUBE_BENCH','OWASP_DEP_CHECK','NPM_AUDIT')
    ),
    CONSTRAINT chk_tool_run_status CHECK (
        status IN ('PENDING','RUNNING','COMPLETED','FAILED','SKIPPED')
    )
);

CREATE INDEX idx_scan_tool_runs_scan_id ON scan_tool_runs(scan_id);
