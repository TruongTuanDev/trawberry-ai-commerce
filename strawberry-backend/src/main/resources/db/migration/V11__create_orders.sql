CREATE TYPE order_status AS ENUM (
    'NEW',
    'ASSEMBLING',
    'SHIPPING',
    'DELIVERED',
    'CANCELLED'
);

CREATE TYPE payment_status AS ENUM (
    'PENDING',
    'WAITING_CONFIRMATION',
    'APPROVED',
    'REJECTED',
    'REFUNDED'
);

CREATE TABLE orders (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES users(id),
    shop_id UUID NOT NULL REFERENCES shops(id),
    order_number VARCHAR(255) NOT NULL UNIQUE,
    status order_status NOT NULL DEFAULT 'NEW',
    payment_status payment_status NOT NULL DEFAULT 'PENDING',
    total_amount DECIMAL(10, 2) NOT NULL,
    shipping_address TEXT NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255),
    customer_note TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_purchase DECIMAL(10, 2) NOT NULL,
    product_title_snapshot VARCHAR(255) NOT NULL,
    product_slug_snapshot VARCHAR(255) NOT NULL,
    variant_attributes_snapshot TEXT,
    product_image_snapshot TEXT,
    wb_nm_id_snapshot BIGINT
);
