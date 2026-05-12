CREATE TABLE "payment_review_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "shop_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "reviewer_user_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "from_status" VARCHAR(50),
    "to_status" VARCHAR(50),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_review_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_review_logs_shop_id_created_at_idx" ON "payment_review_logs"("shop_id", "created_at");
CREATE INDEX "payment_review_logs_order_id_created_at_idx" ON "payment_review_logs"("order_id", "created_at");

ALTER TABLE "payment_review_logs"
ADD CONSTRAINT "payment_review_logs_shop_id_fkey"
FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_review_logs"
ADD CONSTRAINT "payment_review_logs_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_review_logs"
ADD CONSTRAINT "payment_review_logs_reviewer_user_id_fkey"
FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
