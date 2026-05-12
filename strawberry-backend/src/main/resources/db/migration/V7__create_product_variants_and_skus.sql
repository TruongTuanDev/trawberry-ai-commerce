CREATE TABLE product_variants (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- WB Managed
    chrt_id BIGINT NOT NULL,
    tech_size VARCHAR(255),
    wb_size VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Local Managed
    base_price NUMERIC(15, 2) DEFAULT 0.00,
    discount_price NUMERIC(15, 2),
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    reserved_stock INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE (product_id, chrt_id)
);

CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_chrt_id ON product_variants(chrt_id);

CREATE TABLE product_variant_skus (
    id UUID PRIMARY KEY,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    sku VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(variant_id, sku)
);

CREATE INDEX idx_product_variant_skus_variant_id ON product_variant_skus(variant_id);
CREATE INDEX idx_product_variant_skus_sku ON product_variant_skus(sku);
