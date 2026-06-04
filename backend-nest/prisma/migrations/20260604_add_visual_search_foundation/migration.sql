CREATE TABLE "visual_search_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "customer_id" UUID,
    "guest_session_id" VARCHAR(255),
    "image_url" VARCHAR(1000),
    "image_storage_key" VARCHAR(1024),
    "category_hint" VARCHAR(255),
    "detected_category" VARCHAR(255),
    "detected_color" VARCHAR(255),
    "detected_gender" VARCHAR(255),
    "detected_keywords" JSONB,
    "crop_x" INTEGER,
    "crop_y" INTEGER,
    "crop_width" INTEGER,
    "crop_height" INTEGER,
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "provider" VARCHAR(100) NOT NULL DEFAULT 'rule_based_ai_v1',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visual_search_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "visual_search_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "type" VARCHAR(50) NOT NULL,
    "visual_search_log_id" UUID,
    "product_id" UUID,
    "rank" INTEGER,
    "score" DECIMAL(10,4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visual_search_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "visual_search_logs_customer_id_created_at_idx" ON "visual_search_logs"("customer_id", "created_at");
CREATE INDEX "visual_search_logs_guest_session_id_created_at_idx" ON "visual_search_logs"("guest_session_id", "created_at");
CREATE INDEX "visual_search_events_visual_search_log_id_created_at_idx" ON "visual_search_events"("visual_search_log_id", "created_at");
CREATE INDEX "visual_search_events_product_id_created_at_idx" ON "visual_search_events"("product_id", "created_at");
CREATE INDEX "visual_search_events_type_created_at_idx" ON "visual_search_events"("type", "created_at");

ALTER TABLE "visual_search_events"
ADD CONSTRAINT "visual_search_events_visual_search_log_id_fkey"
FOREIGN KEY ("visual_search_log_id") REFERENCES "visual_search_logs"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
