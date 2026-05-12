CREATE TABLE products (
    id UUID PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    
    -- WB Managed Fields (overwritten during sync)
    wb_nm_id BIGINT NOT NULL,
    brand VARCHAR(255),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    category_name VARCHAR(255),
    wb_vendor_code VARCHAR(255),
    wb_created_at TIMESTAMP,
    wb_updated_at TIMESTAMP,
    need_kiz BOOLEAN DEFAULT FALSE,
    subject_id BIGINT,

    -- Local Managed Fields (preserved during sync)
    local_title VARCHAR(500),
    local_description TEXT,
    seo_slug VARCHAR(500),
    visibility VARCHAR(50) DEFAULT 'ACTIVE',
    local_tags JSONB,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE (shop_id, wb_nm_id)
);

CREATE INDEX idx_products_shop_id ON products(shop_id);
CREATE INDEX idx_products_wb_nm_id ON products(wb_nm_id);
