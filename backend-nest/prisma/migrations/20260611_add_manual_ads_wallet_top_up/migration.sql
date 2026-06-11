CREATE TABLE "ads_wallet_top_up_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "seller_id" UUID NOT NULL,
    "requested_by_seller_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'RUB',
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "transfer_reference" VARCHAR(255),
    "proof_url" VARCHAR(1000),
    "seller_note" VARCHAR(1000),
    "admin_note" VARCHAR(1000),
    "rejection_reason" VARCHAR(1000),
    "reviewed_by_admin_id" UUID,
    "confirmed_ledger_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "reviewed_at" TIMESTAMPTZ(6),
    "confirmed_at" TIMESTAMPTZ(6),
    "rejected_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),

    CONSTRAINT "ads_wallet_top_up_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ads_wallet_top_up_requests_confirmed_ledger_id_key"
ON "ads_wallet_top_up_requests"("confirmed_ledger_id");

CREATE INDEX "ads_wallet_top_up_requests_status_created_at_idx"
ON "ads_wallet_top_up_requests"("status", "created_at");

CREATE INDEX "ads_wallet_top_up_requests_seller_id_created_at_idx"
ON "ads_wallet_top_up_requests"("seller_id", "created_at");

CREATE INDEX "ads_wallet_top_up_requests_shop_id_created_at_idx"
ON "ads_wallet_top_up_requests"("shop_id", "created_at");

ALTER TABLE "ads_wallet_top_up_requests"
ADD CONSTRAINT "ads_wallet_top_up_requests_seller_id_fkey"
FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ads_wallet_top_up_requests"
ADD CONSTRAINT "ads_wallet_top_up_requests_requested_by_seller_id_fkey"
FOREIGN KEY ("requested_by_seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ads_wallet_top_up_requests"
ADD CONSTRAINT "ads_wallet_top_up_requests_shop_id_fkey"
FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ads_wallet_top_up_requests"
ADD CONSTRAINT "ads_wallet_top_up_requests_reviewed_by_admin_id_fkey"
FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ads_wallet_top_up_requests"
ADD CONSTRAINT "ads_wallet_top_up_requests_confirmed_ledger_id_fkey"
FOREIGN KEY ("confirmed_ledger_id") REFERENCES "billing_ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
