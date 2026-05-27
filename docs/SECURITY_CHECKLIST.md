# Security Checklist

## Access

- Use SSH keys only.
- Disable password SSH login.
- Restrict sudo access.

## Network

- Expose only `22`, `80`, and `443`.
- Keep PostgreSQL, Redis, MinIO, backend, and `ai-service` off public ports.
- Restrict DB and Redis to Docker-internal access only.

## Secrets

- Never commit `.env` or `.env.production`.
- Rotate `JWT_SECRET` on a real production schedule.
- Rotate `AI_SERVICE_INTERNAL_TOKEN` and keep the same value in backend and `ai-service`.
- Keep `OPENAI_API_KEY` only on the server when used.
- Never store WB API keys in env files for seller runtime credentials.

## Application

- Keep `WB_SYNC_MODE=mock` by default unless real sync is explicitly required.
- Keep `AI_TRY_ON_ENABLED=false` by default in production foundation.
- Keep `AI_TRY_ON_PROVIDER=demo` unless a real OpenAI rollout is approved.
- Admin login must stay off public navigation.

## Storage and data

- Back up PostgreSQL on a schedule.
- Back up MinIO volume data on a schedule.
- Do not commit `data.xlsx`.
- Do not expose private buckets or internal object URLs accidentally.

## Operations

- Run health checks after every deploy.
- Review `docker compose ps` and logs after every deploy.
- Run secret scans before commit when env or deployment files change.
