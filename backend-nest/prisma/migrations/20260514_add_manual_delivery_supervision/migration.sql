ALTER TABLE "delivery_shipments"
  ADD COLUMN IF NOT EXISTS "courier_phone" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "estimated_delivery_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "delivery_note" TEXT;

ALTER TABLE "delivery_events"
  ADD COLUMN IF NOT EXISTS "actor_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "actor_role" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "action" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "old_status" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "new_status" VARCHAR(100);

CREATE INDEX IF NOT EXISTS "delivery_shipments_internal_status_created_at_idx"
  ON "delivery_shipments"("internal_status", "created_at");

CREATE INDEX IF NOT EXISTS "delivery_events_actor_user_id_created_at_idx"
  ON "delivery_events"("actor_user_id", "created_at");
