# Recommendation Ranking Tuning

## Phase 5.4 controlled presets, preview, and rollback

Phase 5.4 introduces a controlled admin workflow around the existing `rule_based_v2` scoring system.

It does not replace the ranking engine. Each preset stores bounded multipliers for existing dimensions:

- category
- text
- popularity
- freshness
- rating
- stock
- shop
- personalization
- analytics performance
- sponsored boost

Versioning model:

- each logical preset has a stable `presetKey`
- each edit creates a new draft version
- only one version can be active platform-wide
- rollback is accepted only from the active version and activates a selected prior version from the same preset family
- create, update, activate, rollback, and archive mutations write audit logs transactionally
- preview writes only its safe audit record, and detail views show recent audit history across the version family

Strict platform limits:

| Dimension | Allowed multiplier |
| --- | --- |
| Core organic dimensions | `0.5..1.5` |
| Personalization | `0..1.5` |
| Analytics performance | `0..1.5` |
| Sponsored boost | `0..1` |

The sponsored multiplier cannot exceed `1`, so controlled tuning cannot increase the sponsored boost produced by the existing campaign and relevance guardrails.

Preset guardrails can only lower or preserve platform maximums:

- sponsored boost score: maximum `5`
- business boost score: maximum `2`
- analytics performance score: maximum absolute `6`
- personalization score: maximum `18`

Feature flags:

- `RECOMMENDATION_TUNING_WORKFLOW_ENABLED=false`
  - hides admin tuning APIs/page when disabled
- `RECOMMENDATION_TUNING_PRESETS_ENABLED=false`
  - blocks create, version, activate, rollback, and archive actions when disabled
- `RECOMMENDATION_TUNING_ACTIVE_PRESET_ENABLED=false`
  - prevents the active preset from affecting public ranking when disabled

Safe rollout sequence:

1. Enable workflow and preset management in local/staging.
2. Create a draft preset.
3. Preview home, search, and similar-product scenarios.
4. Review score/rank movement and guardrail output.
5. Activate the preset while the active runtime flag remains off.
6. Enable the active runtime flag only after signoff.
7. Monitor recommendation analytics and rollback explicitly if needed.

Preview is side-effect free for recommendation and ads behavior:

- no recommendation event writes
- no sponsored CPC charge
- no campaign spend
- no billing ledger entry
- no public response contract changes

Remaining limitations:

- still rule-based and heuristic
- no ML training, embeddings, vector search, or collaborative filtering
- no A/B experimentation or automated tuning recommendations
- no full production ads platform, auction bidding, fraud detection, or real seller funding

## Phase 5.3 scope

Phase 5.3 adds a bounded analytics-based tuning layer on top of the existing `rule_based_v2` recommendation flow.

Included:

- backend-only analytics tuning behind `RECOMMENDATION_ANALYTICS_TUNING_ENABLED`
- safe additive tuning from recent recommendation analytics
- internal explainability support for analytics tuning fields
- admin analytics note that tuning may be active
- QA visibility for analytics tuning signals in `/admin/recommendations-qa`

Out of scope:

- live weight editing UI
- ML training
- seller-controlled ranking weights
- checkout, order, payment, shipping, WB sync, and AI Try-On changes

## Tuning model

The tuning layer is intentionally small and bounded.

Inputs:

- recent recommendation impressions
- recent recommendation clicks
- scenario CTR baseline
- algorithm CTR baseline
- per-product CTR
- per-product click volume

Safe score components:

- `analyticsPerformanceScore`
- `ctrScore`
- `productEngagementScore`
- `algorithmPerformanceHint`
- `scenarioPerformanceHint`

Optional internal explainability flags:

- `analyticsSignalsUsed`
- `analyticsTuningEnabled`

## Safety rules

- disabled by default
- additive only
- bounded by environment caps
- cannot replace the core organic relevance score
- low-CTR penalty is bounded and does not bury low-data or new products
- does not expose raw user ids, guest session ids, cookies, or private tracking payloads
- does not bypass sponsored CPC, wallet, or budget protections

## Flags

Backend:

- `RECOMMENDATION_ANALYTICS_TUNING_ENABLED`
- `RECOMMENDATION_ANALYTICS_MIN_EVENTS_FOR_CTR_BOOST`
- `RECOMMENDATION_ANALYTICS_MIN_CLICKS_FOR_ENGAGEMENT_BOOST`
- `RECOMMENDATION_ANALYTICS_MAX_BOOST`
- `RECOMMENDATION_ANALYTICS_MAX_CTR_BOOST`
- `RECOMMENDATION_ANALYTICS_LOW_CTR_PENALTY`
- `RECOMMENDATION_ANALYTICS_MAX_ENGAGEMENT_BOOST`

Frontend visibility:

- `NEXT_PUBLIC_RECOMMENDATION_ANALYTICS_TUNING_ENABLED`

## Internal QA guide

1. Enable:
   - backend `RECOMMENDATION_ANALYTICS_TUNING_ENABLED=true`
   - optional backend `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
   - optional frontend `NEXT_PUBLIC_RECOMMENDATION_ANALYTICS_TUNING_ENABLED=true`
2. Start backend and frontend locally.
3. Generate recommendation traffic:
   - homepage impressions
   - similar-product impressions
   - search recommendation impressions
   - a few recommendation clicks on selected products
4. Open `/admin/recommendations-analytics` and review:
   - algorithm CTR
   - scenario CTR
   - top recommended products
   - top clicked products
5. Open `/admin/recommendations-qa`.
6. Run the same scenario with `debug=true` enabled in the QA flow.
7. Verify only internal QA/debug surfaces show:
   - `analyticsPerformanceScore`
   - `ctrScore`
   - `productEngagementScore`
   - `algorithmPerformanceHint`
   - `scenarioPerformanceHint`
   - `analyticsSignalsUsed`
8. Re-run the same scenario after future weight changes and compare exported snapshots or QA diffs.

## Expected QA behavior

- public recommendation responses remain backward compatible
- public non-debug responses do not expose analytics tuning internals
- internal explainability can show analytics tuning fields when enabled
- sparse analytics data stays near zero impact
- strong CTR and engagement can improve rank, but only within bounded caps
- very low CTR can add a bounded penalty only when enough impression data exists
