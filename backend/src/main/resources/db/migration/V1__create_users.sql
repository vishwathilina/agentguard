CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id         VARCHAR(50)  NOT NULL UNIQUE,
    login             VARCHAR(100) NOT NULL UNIQUE,
    name              VARCHAR(200),
    email             VARCHAR(255),
    avatar_url        VARCHAR(500),
    access_token_enc  TEXT         NOT NULL,
    created_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    last_login_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_github_id ON users(github_id);
CREATE INDEX idx_users_login     ON users(login);
