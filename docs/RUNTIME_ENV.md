# Runtime Environment Configuration

This guide explains how to set up the environment variables for local development and Docker deployment for the Strawberry project.

> [!WARNING]
> **NEVER COMMIT REAL `.env` FILES TO VERSION CONTROL.** Real `.env` files contain sensitive secrets such as JWT tokens and API keys. The `.gitignore` file is configured to exclude them. Only commit `.env.example` files.

## Environment Variables Setup

Depending on how you run the applications, you will need to create the appropriate `.env` or `.env.local` files based on their examples.

### 1. Local Development Setup
To run the services directly on your local machine, run the following copy operations. The local setup uses `localhost` for inter-service communication.

**backend-nest:**
Copy `backend-nest/.env.example` to `backend-nest/.env`:
```bash
cp backend-nest/.env.example backend-nest/.env
```

**ai-service:**
Copy `ai-service/.env.example` to `ai-service/.env`:
```bash
cp ai-service/.env.example ai-service/.env
```

**frontend-next:**
Copy `frontend-next/.env.example` to `frontend-next/.env.local`:
```bash
cp frontend-next/.env.example frontend-next/.env.local
```

### 2. Docker Deployment Setup
To run the entire stack using Docker Compose, you must use the `infra/.env.example`. This file uses Docker network service names (like `ai-service` and `postgres`) instead of `localhost`.

**infra:**
Copy `infra/.env.example` to `infra/.env`:
```bash
cp infra/.env.example infra/.env
```
Run docker-compose from the repository root:
```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d
```

> [!TIP]
> The host PostgreSQL port is mapped to `5433` by default in `infra/.env` to avoid conflicts if you already have a local PostgreSQL running on port `5432`. Inside the Docker network, services communicate with the database via `postgres:5432`.

## Local vs Docker URLs

> [!IMPORTANT]
> The most critical difference between local development and Docker deployment is the URLs used for service communication.

- **Local Development**: Services are running directly on your host machine. They communicate over `localhost`.
  - `AI_SERVICE_BASE_URL=http://localhost:8000`
- **Docker Deployment**: Services are isolated within a Docker bridge network (`strawberry-net`). They communicate using their container service names.
  - `AI_SERVICE_BASE_URL=http://ai-service:8000`

## AI Image Generation Modes

### Running Mock Mode (Default)
By default, the AI service runs in mock mode. No external API calls to OpenAI will be made, saving costs and ensuring fast local testing.
- Ensure `AI_IMAGE_PROVIDER=mock` is set in `ai-service/.env`.
- Ensure `RUN_OPENAI_SMOKE=false` is set.

### Running Real OpenAI Mode
To use real OpenAI image generation:
1. Open `ai-service/.env` (or `infra/.env` if using Docker).
2. Set `AI_IMAGE_PROVIDER=openai`.
3. Provide your real API key: `OPENAI_API_KEY=sk-...`

## Required vs Optional Variables

### Required Variables
- `DATABASE_URL` (backend-nest): Connection string for PostgreSQL.
- `JWT_SECRET` (backend-nest, infra): Used to sign JWT tokens.
- `AI_SERVICE_INTERNAL_TOKEN` (backend-nest, ai-service, infra): Used to authenticate internal requests between backend-nest and ai-service. Both services MUST share the same exact token.
- `NEXT_PUBLIC_API_URL` (frontend-next, infra): The backend URL the frontend browser will call.

### Security / Authentication Variables (backend-nest, infra)
- `AUTH_COOKIE_NAME`: Name of the `httpOnly` cookie containing the JWT. (Default: `access_token`)
- `AUTH_COOKIE_SECURE`: Must be `true` in production to enforce HTTPS. (Default: `false` for local)
- `AUTH_COOKIE_SAME_SITE`: Protection policy (`lax`, `strict`, `none`). (Default: `lax`)
- `AUTH_COOKIE_MAX_AGE_SECONDS`: Expiration of the cookie in seconds. (Default: `86400`)

### Optional Variables
- `OPENAI_API_KEY` (ai-service, infra): Only required if `AI_IMAGE_PROVIDER=openai`.
- `S3_*` variables (ai-service, infra): Only required if `STORAGE_DRIVER=s3`. Default is `local` for local development.

