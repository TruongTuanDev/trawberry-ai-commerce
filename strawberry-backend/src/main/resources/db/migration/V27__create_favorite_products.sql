CREATE TABLE favorite_products (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_favorite_products_customer_product UNIQUE (customer_id, product_id)
);

CREATE INDEX idx_favorite_products_customer_id ON favorite_products(customer_id);
CREATE INDEX idx_favorite_products_product_id ON favorite_products(product_id);
