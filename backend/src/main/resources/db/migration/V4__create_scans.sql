CREATE TABLE scans (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id        UUID         NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    user_id              UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status               VARCHAR(20)  NOT NULL DEFAULT 'QUEUED',
    commit_sha           VARCHAR(40),
    branch               VARCHAR(100),
    detected_tech_stacks JSONB        NOT NULL DEFAULT '[]',
    total_critical       INT          NOT NULL DEFAULT 0,
    total_high           INT          NOT NULL DEFAULT 0,
    total_medium         INT          NOT NULL DEFAULT 0,
    total_low            INT          NOT NULL DEFAULT 0,
    total_info           INT          NOT NULL DEFAULT 0,
    security_score       INT,
    started_at           TIMESTAMP,
    completed_at         TIMESTAMP,
    created_at           TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_scan_status CHECK (
        status IN ('QUEUED','RUNNING','COMPLETED','FAILED','CANCELLED')
    ),
    CONSTRAINT chk_security_score CHECK (
        security_score IS NULL OR (security_score >= 0 AND security_score <= 100)
    )
);

CREATE INDEX idx_scans_repository_id ON scans(repository_id);
CREATE INDEX idx_scans_user_id       ON scans(user_id);
CREATE INDEX idx_scans_status        ON scans(status);
CREATE INDEX idx_scans_created_at    ON scans(created_at DESC);
