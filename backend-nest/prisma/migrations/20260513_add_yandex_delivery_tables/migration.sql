CREATE TABLE IF NOT EXISTS "shop_delivery_settings" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "shop_id" UUID NOT NULL UNIQUE REFERENCES "shops"("id") ON DELETE CASCADE,
  "pickup_address" TEXT NOT NULL,
  "pickup_city" VARCHAR(255) NOT NULL,
  "pickup_postal_code" VARCHAR(50),
  "pickup_phone" VARCHAR(50) NOT NULL,
  "pickup_contact_name" VARCHAR(255) NOT NULL,
  "enabled_carriers" JSONB NOT NULL,
  "default_carrier" VARCHAR(50) NOT NULL,
  "default_weight" DECIMAL(10,3) NOT NULL,
  "default_length" DECIMAL(10,3) NOT NULL,
  "default_width" DECIMAL(10,3) NOT NULL,
  "default_height" DECIMAL(10,3) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "delivery_offers" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "shop_id" UUID NOT NULL REFERENCES "shops"("id") ON DELETE CASCADE,
  "order_id" UUID NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "provider" VARCHAR(50) NOT NULL,
  "offer_type" VARCHAR(100) NOT NULL,
  "price_amount" DECIMAL(10,2) NOT NULL,
  "price_currency" VARCHAR(10) NOT NULL,
  "estimated_min_days" INTEGER,
  "estimated_max_days" INTEGER,
  "pickup_point_id" VARCHAR(255),
  "raw_provider_payload" JSONB,
  "expires_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "delivery_offers_shop_id_created_at_idx" ON "delivery_offers"("shop_id", "created_at");
CREATE INDEX IF NOT EXISTS "delivery_offers_order_id_created_at_idx" ON "delivery_offers"("order_id", "created_at");

CREATE TABLE IF NOT EXISTS "delivery_shipments" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "shop_id" UUID NOT NULL REFERENCES "shops"("id") ON DELETE CASCADE,
  "order_id" UUID NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "provider" VARCHAR(50) NOT NULL,
  "provider_shipment_id" VARCHAR(255),
  "provider_order_number" VARCHAR(255),
  "provider_status" VARCHAR(100) NOT NULL,
  "internal_status" VARCHAR(100) NOT NULL,
  "price_amount" DECIMAL(10,2),
  "price_currency" VARCHAR(10) NOT NULL,
  "tracking_number" VARCHAR(255),
  "tracking_url" VARCHAR(1000),
  "pickup_address" TEXT NOT NULL,
  "dropoff_address" TEXT NOT NULL,
  "raw_provider_payload" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "accepted_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "delivered_at" TIMESTAMPTZ(6)
);

CREATE INDEX IF NOT EXISTS "delivery_shipments_shop_id_created_at_idx" ON "delivery_shipments"("shop_id", "created_at");
CREATE INDEX IF NOT EXISTS "delivery_shipments_order_id_created_at_idx" ON "delivery_shipments"("order_id", "created_at");
CREATE INDEX IF NOT EXISTS "delivery_shipments_provider_shipment_id_idx" ON "delivery_shipments"("provider_shipment_id");

CREATE TABLE IF NOT EXISTS "delivery_events" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "delivery_shipment_id" UUID NOT NULL REFERENCES "delivery_shipments"("id") ON DELETE CASCADE,
  "shop_id" UUID NOT NULL REFERENCES "shops"("id") ON DELETE CASCADE,
  "order_id" UUID NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "provider" VARCHAR(50) NOT NULL,
  "event_type" VARCHAR(100) NOT NULL,
  "provider_status" VARCHAR(100),
  "message" TEXT,
  "raw_payload" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "delivery_events_delivery_shipment_id_created_at_idx" ON "delivery_events"("delivery_shipment_id", "created_at");
CREATE INDEX IF NOT EXISTS "delivery_events_order_id_created_at_idx" ON "delivery_events"("order_id", "created_at");
