CREATE TABLE "recommendation_tuning_presets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "preset_key" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(1000),
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "weights" JSONB NOT NULL,
    "guardrails" JSONB NOT NULL,
    "created_by_admin_id" UUID NOT NULL,
    "activated_at" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recommendation_tuning_presets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recommendation_tuning_audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "preset_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "actor_admin_id" UUID NOT NULL,
    "previous_value" JSONB,
    "next_value" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_tuning_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recommendation_tuning_presets_preset_key_version_key"
ON "recommendation_tuning_presets"("preset_key", "version");

CREATE UNIQUE INDEX "recommendation_tuning_presets_one_active_key"
ON "recommendation_tuning_presets"("status")
WHERE "status" = 'active';

CREATE INDEX "recommendation_tuning_presets_status_updated_at_idx"
ON "recommendation_tuning_presets"("status", "updated_at");

CREATE INDEX "recommendation_tuning_presets_preset_key_version_idx"
ON "recommendation_tuning_presets"("preset_key", "version");

CREATE INDEX "recommendation_tuning_presets_created_by_admin_id_created_at_idx"
ON "recommendation_tuning_presets"("created_by_admin_id", "created_at");

CREATE INDEX "recommendation_tuning_audit_logs_preset_id_created_at_idx"
ON "recommendation_tuning_audit_logs"("preset_id", "created_at");

CREATE INDEX "recommendation_tuning_audit_logs_actor_admin_id_created_at_idx"
ON "recommendation_tuning_audit_logs"("actor_admin_id", "created_at");

CREATE INDEX "recommendation_tuning_audit_logs_action_created_at_idx"
ON "recommendation_tuning_audit_logs"("action", "created_at");

ALTER TABLE "recommendation_tuning_presets"
ADD CONSTRAINT "recommendation_tuning_presets_created_by_admin_id_fkey"
FOREIGN KEY ("created_by_admin_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recommendation_tuning_audit_logs"
ADD CONSTRAINT "recommendation_tuning_audit_logs_preset_id_fkey"
FOREIGN KEY ("preset_id") REFERENCES "recommendation_tuning_presets"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recommendation_tuning_audit_logs"
ADD CONSTRAINT "recommendation_tuning_audit_logs_actor_admin_id_fkey"
FOREIGN KEY ("actor_admin_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
