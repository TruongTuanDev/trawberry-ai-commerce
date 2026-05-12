CREATE TABLE shipping_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    estimated_days_min INT NOT NULL DEFAULT 1,
    estimated_days_max INT NOT NULL DEFAULT 7,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Seed default shipping methods
INSERT INTO shipping_methods (id, name, description, estimated_days_min, estimated_days_max) VALUES
    (gen_random_uuid(), 'Standard Delivery', 'Regular postal service', 5, 7),
    (gen_random_uuid(), 'Express Delivery',  'Fast courier delivery',  1, 3),
    (gen_random_uuid(), 'Pickup',            'Pickup from seller location', 0, 1);
