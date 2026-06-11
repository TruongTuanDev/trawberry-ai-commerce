ALTER TABLE "sponsored_campaigns"
ADD COLUMN "moderation_status" VARCHAR(50) NOT NULL DEFAULT 'pending_review',
ADD COLUMN "moderation_reason" VARCHAR(1000),
ADD COLUMN "reviewed_by_admin_id" UUID,
ADD COLUMN "reviewed_at" TIMESTAMPTZ(6),
ADD COLUMN "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "sponsored_campaign_moderation_audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "campaign_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "previous_status" VARCHAR(50),
    "next_status" VARCHAR(50) NOT NULL,
    "reason" VARCHAR(1000),
    "admin_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sponsored_campaign_moderation_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sponsored_campaigns_moderation_status_submitted_at_idx"
ON "sponsored_campaigns"("moderation_status", "submitted_at");

CREATE INDEX "sponsored_campaigns_reviewed_by_admin_id_reviewed_at_idx"
ON "sponsored_campaigns"("reviewed_by_admin_id", "reviewed_at");

CREATE INDEX "sponsored_campaign_moderation_audit_logs_campaign_id_created_at_idx"
ON "sponsored_campaign_moderation_audit_logs"("campaign_id", "created_at");

CREATE INDEX "sponsored_campaign_moderation_audit_logs_admin_id_created_at_idx"
ON "sponsored_campaign_moderation_audit_logs"("admin_id", "created_at");

CREATE INDEX "sponsored_campaign_moderation_audit_logs_action_created_at_idx"
ON "sponsored_campaign_moderation_audit_logs"("action", "created_at");

ALTER TABLE "sponsored_campaigns"
ADD CONSTRAINT "sponsored_campaigns_reviewed_by_admin_id_fkey"
FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sponsored_campaign_moderation_audit_logs"
ADD CONSTRAINT "sponsored_campaign_moderation_audit_logs_campaign_id_fkey"
FOREIGN KEY ("campaign_id") REFERENCES "sponsored_campaigns"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sponsored_campaign_moderation_audit_logs"
ADD CONSTRAINT "sponsored_campaign_moderation_audit_logs_admin_id_fkey"
FOREIGN KEY ("admin_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
