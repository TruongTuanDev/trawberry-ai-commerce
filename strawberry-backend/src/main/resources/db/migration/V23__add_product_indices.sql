-- Add performance indices for shop-scoped queries
CREATE INDEX idx_products_shop_nm_id ON products(shop_id, wb_nm_id);
CREATE INDEX idx_products_shop_category ON products(shop_id, category_id);
CREATE INDEX idx_products_shop_visibility_slug ON products(shop_id, visibility, seo_slug);

-- Index for vendor code search
CREATE INDEX idx_products_wb_vendor_code ON products(wb_vendor_code);
