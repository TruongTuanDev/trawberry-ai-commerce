ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL;

ALTER TABLE reviews
DROP CONSTRAINT IF EXISTS reviews_product_id_user_id_key;

ALTER TABLE reviews
ADD CONSTRAINT reviews_order_item_id_key UNIQUE (order_item_id);

CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order_item_id ON reviews(order_item_id);
