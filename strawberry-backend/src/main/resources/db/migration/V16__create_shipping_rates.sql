CREATE TABLE shipping_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
    method_id UUID NOT NULL REFERENCES shipping_methods(id) ON DELETE CASCADE,
    base_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    price_per_kg DECIMAL(10, 2) NOT NULL DEFAULT 0,
    CONSTRAINT uk_shipping_rate UNIQUE (zone_id, method_id)
);

-- Seed default rates: Standard, Express, Pickup for each zone
-- We use subqueries to reliably reference seeded zone/method IDs
INSERT INTO shipping_rates (zone_id, method_id, base_price, price_per_kg)
SELECT z.id, m.id,
    CASE
        WHEN z.name = 'Moscow'           AND m.name = 'Standard Delivery' THEN 299
        WHEN z.name = 'Moscow'           AND m.name = 'Express Delivery'  THEN 599
        WHEN z.name = 'Moscow'           AND m.name = 'Pickup'            THEN 0
        WHEN z.name = 'Saint Petersburg' AND m.name = 'Standard Delivery' THEN 349
        WHEN z.name = 'Saint Petersburg' AND m.name = 'Express Delivery'  THEN 699
        WHEN z.name = 'Saint Petersburg' AND m.name = 'Pickup'            THEN 0
        ELSE 399
    END,
    CASE WHEN m.name = 'Express Delivery' THEN 50 ELSE 0 END
FROM shipping_zones z
CROSS JOIN shipping_methods m;
