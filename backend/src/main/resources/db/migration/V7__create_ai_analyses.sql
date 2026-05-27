CREATE TABLE ai_analyses (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id                  UUID NOT NULL UNIQUE REFERENCES scans(id) ON DELETE CASCADE,
    executive_summary        TEXT,
    prioritized_findings_md  TEXT,
    top_risks                JSONB NOT NULL DEFAULT '[]',
    processing_time_ms       INT,
    model_used               VARCHAR(100),
    created_at               TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_analyses_scan_id ON ai_analyses(scan_id);
