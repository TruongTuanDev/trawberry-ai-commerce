# AGENTS.md

## Project Identity

- This repository hosts a multi-seller e-commerce marketplace.
- Current active stack:
  - `backend-nest`: NestJS + Prisma + PostgreSQL
  - `frontend-next`: Next.js
  - `ai-service`: FastAPI Python
  - `infra`: Docker Compose
- Legacy applications exist in the repo but are not part of the active delivery path and must not be modified unless the user explicitly asks:
  - `strawberry-backend`
  - `strawberry-frontend`

## Core Business Rules

- Sellers sync or import products from WB into their Seller Catalog; imported products are not public by default.
- The public marketplace must display only products that are `PUBLISHED` and have passed readiness checks.
- Sellers control their own product price, stock, and category assignment.
- Backend checkout logic is the source of truth for price, stock, and public visibility.
- Multi-shop checkout must split into child orders per shop.
- Customers receive a parent checkout receipt for the full purchase.
- Admin, Seller, and Customer sessions must stay separate.
- Admin login must never appear in the public navigation.

## External Integrations

### WB API

- WB API keys are entered in the UI and stored encrypted by `shopId`.
- Never store WB API keys in environment files.
- Only call the real WB API when `WB_SYNC_MODE=real`.
- Default tests must use mocks, not the real WB API.

### AI / OpenAI

- Default tests must not call the real OpenAI API.
- Use a mock provider in tests.

### Yandex / CDEK

- Real carrier APIs are not the default integration path yet.
- Manual delivery or seller-managed delivery is currently the primary flow.

### Payments

- Manual payment review is currently the primary payment flow.
- There is no real payment provider in the default path yet.

## Safety Rules

- Never commit real `.env` files.
- Never commit `data.xlsx`.
- Never hardcode API keys, tokens, or secrets.
- Do not modify `strawberry-backend` or `strawberry-frontend` unless the user explicitly requests it.
- Do not fake passing verification.
- If verification fails, stop and report it clearly.
- If the worktree is dirty or mixed-phase, do not create careless commits.

## Required Verification

### Backend (`backend-nest`)

- `npm run prisma:generate`
- `npm run prisma:db:push` if Prisma schema changed
- `npm run lint`
- `npm test -- --runInBand`
- `npm run build`
- Run phase-related smoke checks

### Frontend (`frontend-next`)

- `npm run lint`
- `npm run build`
- Run phase-related E2E checks

### AI Service (`ai-service`) when touched

- `python -m compileall app`
- `python -m pytest -q`

### Runtime checks when needed

- `docker compose -f infra/docker-compose.yml --env-file infra/.env ps`
- `curl` backend health endpoint
- `curl` relevant frontend route
- `curl` ai-service health endpoint

### Git safety checks

- `git diff --check`
- `git ls-files | Select-String "\.env"`
- `git ls-files data.xlsx`
- Run a token or secret scan before commit when relevant

## Documentation Rules

Every phase must update the relevant documentation:

- `docs/PHASE_REPORT.md`
- `docs/PROJECT_STATUS.md`
- `docs/FULL_FLOW_AUDIT.md` if the change affects major flows
- `docs/API_*.md` if any API contract changes
- `README.md` if scripts or workflows are added or changed

## Git Rules

- Commit only after required verification passes.
- Use clear conventional commit prefixes:
  - `feat:`
  - `fix:`
  - `test:`
  - `docs:`
  - `ci:`
  - `chore:`
- Push to `main` only when the user has explicitly asked Codex to push.
- If unrelated files are present outside scope, stash them or stop and report to the user before risky git actions.

## Reporting Format

After each phase, report:

- Commit hash
- Branch pushed
- Files changed
- Verification run
- Smoke / E2E result
- Remaining gaps
- Next recommended phase
