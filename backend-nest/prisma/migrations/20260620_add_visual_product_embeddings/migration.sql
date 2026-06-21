CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "product_image_embeddings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "product_image_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_fingerprint" VARCHAR(64) NOT NULL,
    "model" VARCHAR(255) NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "embedding" vector(512),
    "status" VARCHAR(50) NOT NULL DEFAULT 'READY',
    "last_error" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_image_embeddings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_image_embeddings_product_image_id_key" UNIQUE ("product_image_id"),
    CONSTRAINT "product_image_embeddings_product_image_id_fkey"
      FOREIGN KEY ("product_image_id") REFERENCES "product_images"("id") ON DELETE CASCADE,
    CONSTRAINT "product_image_embeddings_product_id_fkey"
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
);

CREATE INDEX "product_image_embeddings_product_id_status_idx"
ON "product_image_embeddings"("product_id", "status");

CREATE INDEX "product_image_embeddings_embedding_hnsw_idx"
ON "product_image_embeddings"
USING hnsw ("embedding" vector_cosine_ops)
WHERE "embedding" IS NOT NULL AND "status" = 'READY';
