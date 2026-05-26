CREATE TABLE docker_registries (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,
    registry_type    VARCHAR(50)  NOT NULL,
    registry_url     VARCHAR(500),
    credentials_enc  TEXT,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN docker_registries.registry_type IS 'DOCKER_HUB | GHCR | AWS_ECR | AZURE_ACR';

CREATE INDEX idx_docker_registries_user_id ON docker_registries(user_id);
