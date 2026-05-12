CREATE TABLE payment_confirmations (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payer_name VARCHAR(255) NOT NULL,
    transfer_amount DECIMAL(10, 2) NOT NULL,
    transfer_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    receipt_image_url TEXT NOT NULL,
    submitted_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITHOUT TIME ZONE
);
