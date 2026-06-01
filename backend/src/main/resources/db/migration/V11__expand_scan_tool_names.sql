ALTER TABLE scan_tool_runs DROP CONSTRAINT chk_tool_name;

ALTER TABLE scan_tool_runs ADD CONSTRAINT chk_tool_name CHECK (
    tool_name IN (
        'TRIVY', 'GITLEAKS', 'TFSEC', 'KUBE_BENCH', 'OWASP_DEP_CHECK', 'NPM_AUDIT',
        'SEMGREP', 'CHECKOV', 'HADOLINT', 'BANDIT', 'OSV_SCANNER', 'GRYPE', 'DOCKLE'
    )
);
