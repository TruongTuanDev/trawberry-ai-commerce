-- Create product_tags table to persist WB tags
CREATE TABLE product_tags (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    wb_tag_id BIGINT,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_tags_product_id ON product_tags(product_id);
