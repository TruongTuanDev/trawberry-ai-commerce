ALTER TABLE "recommendation_events"
ADD COLUMN "token_hash" VARCHAR(64),
ADD COLUMN "session_hash" VARCHAR(64),
ADD COLUMN "ip_hash" VARCHAR(64),
ADD COLUMN "user_agent_hash" VARCHAR(64),
ADD COLUMN "validity_status" VARCHAR(50) NOT NULL DEFAULT 'not_evaluated',
ADD COLUMN "invalid_reason" VARCHAR(100);

CREATE INDEX "recommendation_events_token_hash_created_at_idx"
ON "recommendation_events"("token_hash", "created_at");

CREATE INDEX "recommendation_events_session_hash_campaign_id_product_id_created_at_idx"
ON "recommendation_events"("session_hash", "campaign_id", "product_id", "created_at");

CREATE INDEX "recommendation_events_ip_hash_user_agent_hash_campaign_id_product_id_created_at_idx"
ON "recommendation_events"("ip_hash", "user_agent_hash", "campaign_id", "product_id", "created_at");

CREATE INDEX "recommendation_events_validity_status_created_at_idx"
ON "recommendation_events"("validity_status", "created_at");
