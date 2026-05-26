# AI Try-On Phase 1

## Scope

Phase 1 adds a stable end-to-end AI Virtual Try-On MVP for public product detail pages:

- admin feature flag and provider configuration
- public `AI Try-On` / `Примерка с ИИ` CTA on product detail
- disabled-mode fallback message without hiding the CTA
- size-gated modal flow
- body profile form
- customer reference upload or built-in model selection
- backend task creation, polling, and mock/demo result delivery
- simple rule-based size recommendation

## Architecture

Flow:

`frontend-next` -> `backend-nest` -> `ai-service` -> try-on provider abstraction

Design choices:

- `backend-nest` is the source of truth for:
  - feature flags
  - provider mode
  - public product validation
  - consent enforcement
  - guest/customer daily limits
  - task persistence and status
- `ai-service` owns provider routing for:
  - `mock`
  - `demo`
  - `openai`
- frontend never calls OpenAI directly
- OpenAI API keys stay server-side in `ai-service`

## Settings

Admin route:

- `/admin/ai-settings`

Stored settings:

- `enabled`
- `providerMode`
- `guestDailyLimit`
- `customerDailyLimit`
- `requireConsent`
- `supportedCategories`

Current defaults:

- feature disabled by default
- provider mode `mock`
- guest limit `3`
- customer limit `5`
- consent required
- supported categories empty = all public-ready products with images are allowed

## Product Support

Phase 1 adds `Product.aiTryOnEnabled`.

Current behavior:

- existing products are backfilled to enabled in the migration for demo continuity
- new product create flow defaults to `aiTryOnEnabled=true` in service logic
- backend still validates:
  - product is public-ready
  - product has an image
  - category is allowed when `supportedCategories` is configured

## Public Flow

Product detail always shows the CTA.

Behavior:

- if global feature is disabled:
  - click shows under-development feedback
- if enabled:
  - user must explicitly choose a size in the size selector
  - modal opens inside the page
- modal supports:
  - height
  - weight
  - gender
  - body type
  - body traits
  - upload photo
  - built-in model selection
  - consent checkbox when required
- submit creates a task and polls until:
  - `COMPLETED`
  - `FAILED`

## Provider Modes

### Mock

- deterministic SVG result
- no real AI call
- stable for local dev and E2E

### Demo

- deterministic category-tinted SVG result
- no real AI call
- better defense/demo storytelling than a flat placeholder

### OpenAI

- separate provider class and env-backed configuration path already exist
- current Phase 1 implementation is a placeholder provider path, not a real garment-generation integration
- if `OPENAI_API_KEY` is missing and mode is `openai`, ai-service returns `AI_PROVIDER_NOT_CONFIGURED`

## OpenAI Readiness

To switch toward real OpenAI integration in Phase 2:

1. set admin provider mode to `openai`
2. configure `OPENAI_API_KEY` in `ai-service`
3. optionally configure `AI_TRY_ON_OPENAI_MODEL`
4. rebuild/restart `ai-service` and dependent services
5. replace the placeholder `OpenAITryOnProvider` implementation with the real generation pipeline

No frontend change is required for that provider swap.

## Size Recommendation

Phase 1 uses rule-based recommendation, not AI sizing.

Rules currently:

- selected size is the baseline
- selected Russian size is preserved when provided
- `wide_shoulders` on tops suggests considering more room
- `large_belly` suggests relaxed fit / one size up consideration
- `long_legs` on bottoms lowers confidence and warns to check length
- `slim` body type raises confidence for the selected size

Disclaimer returned in UI:

- recommendation is for reference only

## Privacy And Consent

- consent is enforced server-side when `requireConsent=true`
- customer images are stored through backend storage, never directly exposed to provider credentials
- public upload flow supports guest and authenticated customer sessions

## Rate Limits

Enforced in `backend-nest` per UTC day:

- guest: by guest session id header / fallback session source
- customer: by authenticated customer id

Current Phase 1 counting is task-based.

## Current Limitations

- OpenAI try-on provider is wired but still placeholder-only
- built-in models use local static demo assets
- size recommendation is intentionally conservative and explainable
- product-level seller UI toggle is not yet exposed in Seller Center, although backend product support exists
