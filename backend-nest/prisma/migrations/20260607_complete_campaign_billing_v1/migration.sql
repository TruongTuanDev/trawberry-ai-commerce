ALTER TABLE "recommendation_events"
ADD COLUMN "shop_id" UUID,
ADD COLUMN "campaign_id" UUID,
ADD COLUMN "scenario_type" VARCHAR(50),
ADD COLUMN "billing_mode" VARCHAR(50),
ADD COLUMN "sponsored" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "charged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "charge_status" VARCHAR(50) NOT NULL DEFAULT 'not_billable',
ADD COLUMN "cost" DECIMAL(14,2),
ADD COLUMN "ledger_entry_id" UUID,
ADD COLUMN "idempotency_key" VARCHAR(255),
ADD COLUMN "metadata" JSONB;

CREATE UNIQUE INDEX "recommendation_events_idempotency_key_key" ON "recommendation_events"("idempotency_key");
CREATE INDEX "recommendation_events_shop_id_created_at_idx" ON "recommendation_events"("shop_id", "created_at");
CREATE INDEX "recommendation_events_campaign_id_created_at_idx" ON "recommendation_events"("campaign_id", "created_at");
CREATE INDEX "recommendation_events_charge_status_created_at_idx" ON "recommendation_events"("charge_status", "created_at");

ALTER TABLE "recommendation_events"
ADD CONSTRAINT "recommendation_events_shop_id_fkey"
FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recommendation_events"
ADD CONSTRAINT "recommendation_events_campaign_id_fkey"
FOREIGN KEY ("campaign_id") REFERENCES "sponsored_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recommendation_events"
ADD CONSTRAINT "recommendation_events_ledger_entry_id_fkey"
FOREIGN KEY ("ledger_entry_id") REFERENCES "billing_ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
