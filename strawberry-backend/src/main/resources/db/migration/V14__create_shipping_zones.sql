CREATE TABLE shipping_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'Russia',
    region VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default Russian delivery zones
INSERT INTO shipping_zones (id, name, country, region) VALUES
    (gen_random_uuid(), 'Moscow', 'Russia', 'Moscow'),
    (gen_random_uuid(), 'Saint Petersburg', 'Russia', 'Saint Petersburg'),
    (gen_random_uuid(), 'Other Regions', 'Russia', NULL);
