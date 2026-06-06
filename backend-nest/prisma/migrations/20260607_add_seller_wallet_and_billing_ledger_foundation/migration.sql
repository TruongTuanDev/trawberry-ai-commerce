CREATE TABLE "seller_wallets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "shop_id" UUID NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reserved_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'RUB',
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_wallets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_ledger_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "wallet_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "campaign_id" UUID,
    "type" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'RUB',
    "balance_before" DECIMAL(14,2) NOT NULL,
    "balance_after" DECIMAL(14,2) NOT NULL,
    "reserved_before" DECIMAL(14,2) NOT NULL,
    "reserved_after" DECIMAL(14,2) NOT NULL,
    "reference_type" VARCHAR(100),
    "reference_id" VARCHAR(255),
    "description" VARCHAR(500),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seller_wallets_shop_id_key" ON "seller_wallets"("shop_id");
CREATE INDEX "seller_wallets_status_created_at_idx" ON "seller_wallets"("status", "created_at");

CREATE INDEX "billing_ledger_entries_wallet_id_created_at_idx" ON "billing_ledger_entries"("wallet_id", "created_at");
CREATE INDEX "billing_ledger_entries_shop_id_created_at_idx" ON "billing_ledger_entries"("shop_id", "created_at");
CREATE INDEX "billing_ledger_entries_campaign_id_created_at_idx" ON "billing_ledger_entries"("campaign_id", "created_at");
CREATE INDEX "billing_ledger_entries_type_created_at_idx" ON "billing_ledger_entries"("type", "created_at");

ALTER TABLE "seller_wallets"
    ADD CONSTRAINT "seller_wallets_shop_id_fkey"
    FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "billing_ledger_entries"
    ADD CONSTRAINT "billing_ledger_entries_wallet_id_fkey"
    FOREIGN KEY ("wallet_id") REFERENCES "seller_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "billing_ledger_entries"
    ADD CONSTRAINT "billing_ledger_entries_shop_id_fkey"
    FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "billing_ledger_entries"
    ADD CONSTRAINT "billing_ledger_entries_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "sponsored_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
