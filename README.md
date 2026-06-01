<table>
  <tr>
    <td valign="top">
      <img src="frontend/public/logo.png" alt="AgentGuard Logo" width="200"/>
    </td>
    <td valign="top">
      <h1>AgentGuard Platform</h1>
      <p>AI-powered DevSecOps platform for scanning GitHub repositories and container targets, aggregating vulnerability findings, and delivering actionable security intelligence.</p>
      <p>This repository supports two runtime models:</p>
      <ul>
        <li>Compose-based local stack for full development and integration testing</li>
        <li>Local or hosted services with a Hugging Face Ollama-compatible endpoint for cloud AI analysis</li>
      </ul>
    </td>
  </tr>
</table>

## Technologies Used

![Java](https://img.shields.io/badge/Java-21-007396?style=flat-square&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3-6DB33F?style=flat-square&logo=springboot&logoColor=white)
![Maven](https://img.shields.io/badge/Maven-C71A36?style=flat-square&logo=apachemaven&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=flat-square&logo=rabbitmq&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-000000?style=flat-square)
![LangChain4j](https://img.shields.io/badge/LangChain4j-1C3C3C?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![Hugging Face](https://img.shields.io/badge/Hugging%20Face-FFD21E?style=flat-square&logo=huggingface&logoColor=black)

## What This Platform Does

- Sign in with GitHub OAuth and manage connected repositories
- Register GitHub repos and Docker registry targets for scanning
- Run multi-tool security scans with automatic technology-stack detection
- Orchestrate 13+ scanners (Trivy, Semgrep, Gitleaks, Checkov, Grype, and more)
- Stream live scan progress over WebSockets
- Store findings, severity, and tool-run metadata in PostgreSQL
- Generate AI executive summaries, risk scores, and remediation guidance via Ollama
- Visualize security posture on a Next.js dashboard with trends and alerts
- Send Discord notifications for critical findings and scan events

## Runtime Models

### 1) Compose Local Runtime

Use the Compose stack when you want a complete local environment with all dependencies.

Defined in:

- `docker-compose.yml`

Local Compose services:

- PostgreSQL (database)
- Redis (caching)
- RabbitMQ (message broker)
- Ollama (local AI model runtime)
- Backend API (Spring Boot scan orchestrator)
- Frontend app (Next.js)

Default local endpoints:

- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- Backend health: http://localhost:8080/actuator/health
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- RabbitMQ: localhost:5672
- RabbitMQ management UI: http://localhost:15672
- Ollama: http://localhost:11434

Quick start:

```bash
cp .env.example .env
# Fill in GitHub OAuth, database, and secret values
docker compose up --build
```

### 2) Local Dev + Cloud AI Runtime

Run backend and frontend directly on your machine while pointing AI and data services to hosted endpoints.

Typical setup:

- Backend: `cd backend && mvn spring-boot:run`
- Frontend: `cd frontend && npm install && npm run dev`
- Database: Neon PostgreSQL or local Postgres
- Redis: local instance or Upstash
- AI: Hugging Face Space Ollama-compatible endpoint

Environment template:

- `.env.example` (root)
- `backend/.env` (Spring Boot / database / AI)
- `frontend/.env.local` (NextAuth + API URLs)

Common frontend env values:

- `NEXT_PUBLIC_API_URL=http://localhost:8080`
- `NEXT_PUBLIC_WS_URL=ws://localhost:8080`
- `NEXTAUTH_URL=http://localhost:3000`

Default cloud AI endpoint (override in `.env`):

- `OLLAMA_BASE_URL=https://vish85521-qwen.hf.space`
- `OLLAMA_MODEL=gemma4:31b-cloud`

## Repository Structure

### Root folders

- `backend`: Spring Boot API, scan orchestration, AI analysis, and WebSocket progress
- `frontend`: Next.js dashboard, auth, and scan visualization UI
- `scripts`: utility scripts (reserved)
- `docker-compose.yml`: full local stack definition
- `.env.example`: shared environment variable template

### Backend (`backend/`)

- `src/main/java/com/devsecops/ai`: LangChain4j + Ollama vulnerability analysis
- `src/main/java/com/devsecops/api`: REST controllers (scans, repos, settings, alerts)
- `src/main/java/com/devsecops/auth`: GitHub OAuth and Spring Security
- `src/main/java/com/devsecops/github`: GitHub API integration
- `src/main/java/com/devsecops/scan`: scan orchestrator, tech detection, tool runners
- `src/main/java/com/devsecops/scan/runners`: individual scanner integrations
- `src/main/java/com/devsecops/notification`: Discord alert delivery
- `src/main/java/com/devsecops/ws`: WebSocket scan progress streaming
- `src/main/java/com/devsecops/model`: JPA entities and enums
- `src/main/java/com/devsecops/repository`: Spring Data repositories
- `src/main/resources/db/migration`: Flyway SQL migrations

Supported scan tools:

- Trivy, Grype, Gitleaks, Semgrep, Checkov, Tfsec, Hadolint, Bandit, OSV Scanner, OWASP Dependency-Check, npm audit, Kube-bench, Dockle

### Frontend (`frontend/`)

- `app/`: App Router pages
  - `/dashboard` — security overview and trends
  - `/scans` — findings and scan detail
  - `/repositories` — GitHub and Docker target management
  - `/ai-insights` — AI-generated intelligence
  - `/alerts` — notification events
  - `/settings` — platform configuration
- `components/`: UI, dashboard widgets, layout, and scan panels
- `lib/`: API client and shared utilities
- `public/`: static assets (`logo.png`, favicon)

## Security Notes

- Never commit `.env`, `backend/.env`, or `frontend/.env.local` — they are listed in `.gitignore`
- GitHub tokens and registry credentials are encrypted at rest with Jasypt
- Create a GitHub OAuth App with callback URL `http://localhost:3000/api/auth/callback/github` for local development
