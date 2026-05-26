CREATE TABLE repositories (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    docker_registry_id      UUID         REFERENCES docker_registries(id) ON DELETE SET NULL,
    target_type             VARCHAR(20)  NOT NULL,
    github_repo_full_name   VARCHAR(300),
    docker_image            VARCHAR(500),
    default_branch          VARCHAR(100) DEFAULT 'main',
    last_scanned_at         TIMESTAMP,
    created_at              TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_target_type CHECK (target_type IN ('GIT_REPO', 'DOCKER_IMAGE')),
    CONSTRAINT chk_git_repo CHECK (
        target_type != 'GIT_REPO' OR github_repo_full_name IS NOT NULL
    ),
    CONSTRAINT chk_docker_image CHECK (
        target_type != 'DOCKER_IMAGE' OR docker_image IS NOT NULL
    )
);

CREATE INDEX idx_repositories_user_id ON repositories(user_id);
