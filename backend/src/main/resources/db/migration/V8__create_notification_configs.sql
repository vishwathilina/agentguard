CREATE TABLE notification_configs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_type     VARCHAR(20)  NOT NULL DEFAULT 'DISCORD',
    webhook_url_enc  TEXT         NOT NULL,
    min_severity     VARCHAR(10)  NOT NULL DEFAULT 'HIGH',
    enabled          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_channel_type  CHECK (channel_type IN ('DISCORD','SLACK','EMAIL')),
    CONSTRAINT chk_min_severity  CHECK (min_severity IN ('CRITICAL','HIGH','MEDIUM','LOW','INFO'))
);

CREATE INDEX idx_notification_configs_user_id ON notification_configs(user_id);
