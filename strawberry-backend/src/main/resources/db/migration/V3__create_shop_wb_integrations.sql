CREATE TABLE shop_wb_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    api_key_encrypted VARCHAR(1024) NOT NULL,
    locale VARCHAR(20) DEFAULT 'ru',
    is_active BOOLEAN DEFAULT true,
    last_cursor_updated_at TIMESTAMP WITH TIME ZONE,
    last_cursor_nm_id BIGINT,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(50),
    last_error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_shop_integration UNIQUE (shop_id)
);
