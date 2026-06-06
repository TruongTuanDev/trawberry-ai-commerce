CREATE TABLE "sponsored_campaigns" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "shop_id" UUID NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" VARCHAR(1000),
  "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
  "scenario_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "start_at" TIMESTAMPTZ(6),
  "end_at" TIMESTAMPTZ(6),
  "budget_limit" DECIMAL(12,2),
  "billing_mode" VARCHAR(50) NOT NULL DEFAULT 'none',
  "max_boost" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sponsored_campaigns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sponsored_campaigns_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "sponsored_campaign_products" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "campaign_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "boost" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "status" VARCHAR(50) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sponsored_campaign_products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sponsored_campaign_products_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "sponsored_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sponsored_campaign_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sponsored_campaign_products_campaign_id_product_id_key"
  ON "sponsored_campaign_products"("campaign_id", "product_id");

CREATE INDEX "sponsored_campaigns_shop_id_status_updated_at_idx"
  ON "sponsored_campaigns"("shop_id", "status", "updated_at");

CREATE INDEX "sponsored_campaigns_shop_id_created_at_idx"
  ON "sponsored_campaigns"("shop_id", "created_at");

CREATE INDEX "sponsored_campaign_products_campaign_id_status_updated_at_idx"
  ON "sponsored_campaign_products"("campaign_id", "status", "updated_at");

CREATE INDEX "sponsored_campaign_products_product_id_status_idx"
  ON "sponsored_campaign_products"("product_id", "status");
