ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "external_source" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "external_product_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "seller_sku" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "gender" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "composition" TEXT,
  ADD COLUMN IF NOT EXISTS "color" VARCHAR(255);

ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "external_source" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "seller_sku" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "wb_barcode" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "size_name" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "russian_size" VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS "products_shop_id_seller_sku_key" ON "products"("shop_id", "seller_sku");
CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_product_id_seller_sku_size_name_russian_size_key"
  ON "product_variants"("product_id", "seller_sku", "size_name", "russian_size");
CREATE INDEX IF NOT EXISTS "product_variants_wb_barcode_idx" ON "product_variants"("wb_barcode");

CREATE TABLE IF NOT EXISTS "product_import_sessions" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "shop_id" UUID NOT NULL,
  "seller_id" UUID NOT NULL,
  "source" VARCHAR(100) NOT NULL,
  "original_file_name" VARCHAR(255) NOT NULL,
  "status" VARCHAR(50) NOT NULL,
  "total_rows" INTEGER NOT NULL DEFAULT 0,
  "total_products" INTEGER NOT NULL DEFAULT 0,
  "total_variants" INTEGER NOT NULL DEFAULT 0,
  "total_images" INTEGER NOT NULL DEFAULT 0,
  "warnings_json" JSONB NOT NULL DEFAULT '[]',
  "errors_json" JSONB NOT NULL DEFAULT '[]',
  "normalized_payload_json" JSONB NOT NULL,
  "options_json" JSONB,
  "result_json" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "product_import_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_import_sessions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_import_sessions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "product_import_sessions_shop_id_created_at_idx" ON "product_import_sessions"("shop_id", "created_at");
CREATE INDEX IF NOT EXISTS "product_import_sessions_seller_id_created_at_idx" ON "product_import_sessions"("seller_id", "created_at");
