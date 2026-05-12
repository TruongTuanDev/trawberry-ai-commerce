CREATE TABLE product_images (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    wb_url VARCHAR(1000) NOT NULL,
    local_url VARCHAR(1000),
    is_main BOOLEAN DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_images_product_id ON product_images(product_id);

CREATE TABLE product_characteristics (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    wb_char_id BIGINT,
    name VARCHAR(255) NOT NULL,
    raw_value_json JSONB NOT NULL,
    normalized_text TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_characteristics_product_id ON product_characteristics(product_id);
