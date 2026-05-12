-- Add rating and feedback metrics to products
ALTER TABLE products 
ADD COLUMN average_rating DECIMAL(3, 2) DEFAULT 0,
ADD COLUMN feedback_count INTEGER DEFAULT 0;

-- Optional: Initialize some dummy values for existing products for demo visibility
UPDATE products SET average_rating = 4.5, feedback_count = 127 WHERE title = 'Antigravity Ultra 4000';
