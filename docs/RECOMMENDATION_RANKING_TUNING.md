# Recommendation Ranking Tuning

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
