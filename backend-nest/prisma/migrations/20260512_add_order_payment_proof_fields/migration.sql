ALTER TABLE "orders"
ADD COLUMN "payment_proof_url" VARCHAR(1000),
ADD COLUMN "payment_proof_storage_key" VARCHAR(1024),
ADD COLUMN "payment_proof_original_name" VARCHAR(255),
ADD COLUMN "payment_proof_mime_type" VARCHAR(100),
ADD COLUMN "payment_proof_size" INTEGER,
ADD COLUMN "payment_proof_uploaded_at" TIMESTAMPTZ(6);
