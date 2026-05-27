-- Additional performance indexes for common query patterns

-- Repositories by user + target type
CREATE INDEX idx_repositories_user_type ON repositories(user_id, target_type);

-- Scans by repository sorted by date (for scan history view)
CREATE INDEX idx_scans_repo_created ON scans(repository_id, created_at DESC);

-- Notification events by config
CREATE INDEX idx_notif_events_config ON notification_events(notification_config_id);

-- Full-text search on vulnerability titles (optional but useful)
CREATE INDEX idx_vuln_title_trgm ON vulnerabilities USING GIN (to_tsvector('english', title));
