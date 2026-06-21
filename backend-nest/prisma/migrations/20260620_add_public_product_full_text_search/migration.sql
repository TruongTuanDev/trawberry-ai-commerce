CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "products_search_vector_idx"
ON "products"
USING GIN ((
  setweight(to_tsvector('simple', COALESCE("local_title", '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE("wb_title", '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE("brand", '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE("category_name", '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE("source_category_name", '')), 'B') ||
  setweight(to_tsvector('simple', COALESCE("wb_vendor_code", '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE("seller_sku", '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE("color", '')), 'C') ||
  setweight(to_tsvector('simple', COALESCE("gender", '')), 'C') ||
  setweight(to_tsvector('simple', COALESCE("local_description", '')), 'D') ||
  setweight(to_tsvector('simple', COALESCE("wb_description", '')), 'D')
));

CREATE INDEX IF NOT EXISTS "products_local_title_trgm_idx"
ON "products" USING GIN (lower(COALESCE("local_title", '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "products_wb_title_trgm_idx"
ON "products" USING GIN (lower(COALESCE("wb_title", '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "products_brand_trgm_idx"
ON "products" USING GIN (lower(COALESCE("brand", '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "products_category_name_trgm_idx"
ON "products" USING GIN (lower(COALESCE("category_name", '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "products_source_category_name_trgm_idx"
ON "products" USING GIN (lower(COALESCE("source_category_name", '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "products_wb_vendor_code_trgm_idx"
ON "products" USING GIN (lower(COALESCE("wb_vendor_code", '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "products_seller_sku_trgm_idx"
ON "products" USING GIN (lower(COALESCE("seller_sku", '')) gin_trgm_ops);
