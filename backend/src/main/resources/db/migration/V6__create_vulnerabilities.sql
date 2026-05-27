CREATE TABLE vulnerabilities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id             UUID         NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    scan_tool_run_id    UUID         NOT NULL REFERENCES scan_tool_runs(id) ON DELETE CASCADE,
    tool_source         VARCHAR(50)  NOT NULL,
    cve_id              VARCHAR(30),
    title               VARCHAR(500) NOT NULL,
    description         TEXT,
    severity            VARCHAR(10)  NOT NULL,
    category            VARCHAR(30)  NOT NULL,
    affected_component  VARCHAR(500),
    affected_version    VARCHAR(100),
    fixed_version       VARCHAR(100),
    file_path           VARCHAR(1000),
    line_number         INT,
    cvss_score          NUMERIC(4,1),
    cvss_vector         VARCHAR(200),
    is_exploitable      BOOLEAN      NOT NULL DEFAULT FALSE,
    is_internet_exposed BOOLEAN      NOT NULL DEFAULT FALSE,
    is_in_production    BOOLEAN      NOT NULL DEFAULT FALSE,
    ai_risk_score       NUMERIC(4,1),
    ai_explanation      TEXT,
    ai_remediation      TEXT,
    status              VARCHAR(20)  NOT NULL DEFAULT 'OPEN',
    suppression_reason  TEXT,
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_vuln_severity CHECK (
        severity IN ('CRITICAL','HIGH','MEDIUM','LOW','INFO')
    ),
    CONSTRAINT chk_vuln_category CHECK (
        category IN ('CVE','SECRET','IAC_MISCONFIG','DEPENDENCY','K8S_SECURITY','SAST')
    ),
    CONSTRAINT chk_vuln_status CHECK (
        status IN ('OPEN','ACKNOWLEDGED','SUPPRESSED','FIXED')
    )
);

CREATE INDEX idx_vuln_scan_severity   ON vulnerabilities(scan_id, severity);
CREATE INDEX idx_vuln_scan_status     ON vulnerabilities(scan_id, status);
CREATE INDEX idx_vuln_cve_id          ON vulnerabilities(cve_id) WHERE cve_id IS NOT NULL;
CREATE INDEX idx_vuln_ai_risk_score   ON vulnerabilities(scan_id, ai_risk_score DESC NULLS LAST);
