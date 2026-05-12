ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_completed_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS delivery_issue_reports (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL,
    customer_note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_issue_reports_order_id ON delivery_issue_reports(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_issue_reports_customer_id ON delivery_issue_reports(customer_id);
