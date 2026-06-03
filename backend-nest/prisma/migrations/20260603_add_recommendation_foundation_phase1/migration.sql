CREATE TABLE "product_view_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "product_id" UUID,
    "customer_id" UUID,
    "guest_session_id" VARCHAR(255),
    "shop_id" UUID,
    "source" VARCHAR(100),
    "referrer" VARCHAR(1000),
    "user_agent" VARCHAR(1000),
    "ip_hash" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_view_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "search_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "query" VARCHAR(500) NOT NULL,
    "normalized_query" VARCHAR(500),
    "customer_id" UUID,
    "guest_session_id" VARCHAR(255),
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "locale" VARCHAR(20),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recommendation_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "type" VARCHAR(50) NOT NULL,
    "placement" VARCHAR(100) NOT NULL,
    "product_id" UUID NOT NULL,
    "source_product_id" UUID,
    "customer_id" UUID,
    "guest_session_id" VARCHAR(255),
    "algorithm" VARCHAR(100) NOT NULL DEFAULT 'rule_based_v1',
    "rank" INTEGER,
    "score" DECIMAL(10,4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_view_logs_product_id_created_at_idx" ON "product_view_logs"("product_id", "created_at");
CREATE INDEX "product_view_logs_customer_id_created_at_idx" ON "product_view_logs"("customer_id", "created_at");
CREATE INDEX "product_view_logs_guest_session_id_created_at_idx" ON "product_view_logs"("guest_session_id", "created_at");
CREATE INDEX "product_view_logs_shop_id_created_at_idx" ON "product_view_logs"("shop_id", "created_at");

CREATE INDEX "search_logs_normalized_query_created_at_idx" ON "search_logs"("normalized_query", "created_at");
CREATE INDEX "search_logs_customer_id_created_at_idx" ON "search_logs"("customer_id", "created_at");
CREATE INDEX "search_logs_guest_session_id_created_at_idx" ON "search_logs"("guest_session_id", "created_at");

CREATE INDEX "recommendation_events_product_id_created_at_idx" ON "recommendation_events"("product_id", "created_at");
CREATE INDEX "recommendation_events_source_product_id_created_at_idx" ON "recommendation_events"("source_product_id", "created_at");
CREATE INDEX "recommendation_events_customer_id_created_at_idx" ON "recommendation_events"("customer_id", "created_at");
CREATE INDEX "recommendation_events_guest_session_id_created_at_idx" ON "recommendation_events"("guest_session_id", "created_at");
CREATE INDEX "recommendation_events_placement_type_created_at_idx" ON "recommendation_events"("placement", "type", "created_at");
