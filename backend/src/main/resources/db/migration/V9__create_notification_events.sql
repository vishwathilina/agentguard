CREATE TABLE notification_events (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id                 UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    notification_config_id  UUID NOT NULL REFERENCES notification_configs(id) ON DELETE CASCADE,
    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    payload                 TEXT,
    error_message           TEXT,
    sent_at                 TIMESTAMP,

    CONSTRAINT chk_notif_event_status CHECK (status IN ('PENDING','SENT','FAILED'))
);

CREATE INDEX idx_notif_events_scan_id ON notification_events(scan_id);
CREATE INDEX idx_notif_events_status  ON notification_events(status);
