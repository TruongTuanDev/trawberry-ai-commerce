ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "ai_try_on_enabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "products"
SET "ai_try_on_enabled" = true
WHERE "ai_try_on_enabled" = false;

CREATE TABLE IF NOT EXISTS "ai_feature_settings" (
  "id" VARCHAR(64) NOT NULL,
  "ai_try_on_enabled" BOOLEAN NOT NULL DEFAULT false,
  "ai_try_on_provider" VARCHAR(50) NOT NULL DEFAULT 'mock',
  "guest_daily_limit" INTEGER NOT NULL DEFAULT 3,
  "customer_daily_limit" INTEGER NOT NULL DEFAULT 5,
  "require_consent" BOOLEAN NOT NULL DEFAULT true,
  "supported_categories" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_feature_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_try_on_tasks" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "customer_id" UUID,
  "guest_session_id" VARCHAR(255),
  "shop_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "selected_size" VARCHAR(255),
  "selected_russian_size" VARCHAR(255),
  "customer_image_url" VARCHAR(1000),
  "customer_image_storage_key" VARCHAR(1024),
  "selected_model_id" VARCHAR(255),
  "height_cm" INTEGER,
  "weight_kg" INTEGER,
  "gender" VARCHAR(50),
  "body_type" VARCHAR(50),
  "body_traits" JSONB,
  "consent_accepted" BOOLEAN NOT NULL DEFAULT false,
  "provider_mode" VARCHAR(50) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  "result_image_url" VARCHAR(1000),
  "result_image_storage_key" VARCHAR(1024),
  "result_mime_type" VARCHAR(100),
  "result_width" INTEGER,
  "result_height" INTEGER,
  "recommended_size" VARCHAR(255),
  "recommended_russian_size" VARCHAR(255),
  "size_recommendation_note" TEXT,
  "size_recommendation_note_ru" TEXT,
  "size_recommendation_note_en" TEXT,
  "size_recommendation_confidence" VARCHAR(50),
  "error_code" VARCHAR(100),
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "ai_try_on_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_try_on_tasks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_try_on_tasks_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_try_on_tasks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ai_try_on_usage_logs" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "task_id" UUID,
  "customer_id" UUID,
  "guest_session_id" VARCHAR(255),
  "shop_id" UUID NOT NULL,
  "product_id" UUID,
  "provider_mode" VARCHAR(50) NOT NULL,
  "status" VARCHAR(50) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_try_on_usage_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_try_on_usage_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "ai_try_on_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_try_on_usage_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_try_on_usage_logs_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_try_on_usage_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_try_on_tasks_customer_id_created_at_idx"
ON "ai_try_on_tasks"("customer_id", "created_at");

CREATE INDEX IF NOT EXISTS "ai_try_on_tasks_guest_session_id_created_at_idx"
ON "ai_try_on_tasks"("guest_session_id", "created_at");

CREATE INDEX IF NOT EXISTS "ai_try_on_tasks_shop_id_created_at_idx"
ON "ai_try_on_tasks"("shop_id", "created_at");

CREATE INDEX IF NOT EXISTS "ai_try_on_tasks_product_id_created_at_idx"
ON "ai_try_on_tasks"("product_id", "created_at");

CREATE INDEX IF NOT EXISTS "ai_try_on_tasks_status_created_at_idx"
ON "ai_try_on_tasks"("status", "created_at");

CREATE INDEX IF NOT EXISTS "ai_try_on_usage_logs_customer_id_created_at_idx"
ON "ai_try_on_usage_logs"("customer_id", "created_at");

CREATE INDEX IF NOT EXISTS "ai_try_on_usage_logs_guest_session_id_created_at_idx"
ON "ai_try_on_usage_logs"("guest_session_id", "created_at");

CREATE INDEX IF NOT EXISTS "ai_try_on_usage_logs_product_id_created_at_idx"
ON "ai_try_on_usage_logs"("product_id", "created_at");

CREATE INDEX IF NOT EXISTS "ai_try_on_usage_logs_shop_id_created_at_idx"
ON "ai_try_on_usage_logs"("shop_id", "created_at");

INSERT INTO "ai_feature_settings" (
  "id",
  "ai_try_on_enabled",
  "ai_try_on_provider",
  "guest_daily_limit",
  "customer_daily_limit",
  "require_consent",
  "supported_categories"
)
VALUES (
  'default',
  false,
  'mock',
  3,
  5,
  true,
  '[]'::jsonb
)
ON CONFLICT ("id") DO NOTHING;
