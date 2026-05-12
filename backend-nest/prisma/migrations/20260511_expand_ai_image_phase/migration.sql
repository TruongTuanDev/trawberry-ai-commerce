ALTER TABLE "ai_generation_tasks"
ADD COLUMN IF NOT EXISTS "task_type" VARCHAR(50) NOT NULL DEFAULT 'PRODUCT_MODEL_IMAGE',
ADD COLUMN IF NOT EXISTS "input_front_image_id" UUID NULL REFERENCES "product_images"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "input_back_image_id" UUID NULL REFERENCES "product_images"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "input_model_image_id" UUID NULL REFERENCES "product_images"("id") ON DELETE SET NULL;

ALTER TABLE "ai_generated_images"
ADD COLUMN IF NOT EXISTS "shop_id" UUID NULL REFERENCES "shops"("id") ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS "storage_key" VARCHAR(1024),
ADD COLUMN IF NOT EXISTS "provider" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "is_selected" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "ai_generated_images" ag
SET "shop_id" = t."shop_id"
FROM "ai_generation_tasks" t
WHERE ag."task_id" = t."id" AND ag."shop_id" IS NULL;

ALTER TABLE "ai_generated_images"
ALTER COLUMN "shop_id" SET NOT NULL;

ALTER TABLE "seller_ai_credits"
ADD COLUMN IF NOT EXISTS "total_credits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "used_credits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "remaining_credits" INTEGER NOT NULL DEFAULT 0;

UPDATE "seller_ai_credits"
SET
  "remaining_credits" = COALESCE("remaining_credits", 0),
  "total_credits" = CASE
    WHEN "total_credits" = 0 THEN COALESCE("balance", 0) + COALESCE("reserved", 0)
    ELSE "total_credits"
  END,
  "used_credits" = CASE
    WHEN "used_credits" = 0 THEN GREATEST(COALESCE("total_credits", 0) - COALESCE("balance", 0), 0)
    ELSE "used_credits"
  END;

ALTER TABLE "ai_usage_logs"
ADD COLUMN IF NOT EXISTS "provider" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "credit_cost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "status" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "error_message" TEXT;
