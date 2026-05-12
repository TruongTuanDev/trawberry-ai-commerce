-- Create categories table
CREATE TABLE categories (
    id BIGINT PRIMARY KEY, -- subjectID from WB
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add category_id and other WB metadata to products
ALTER TABLE products
ADD COLUMN category_id BIGINT REFERENCES categories(id),
ADD COLUMN wb_imt_id BIGINT,
ADD COLUMN wb_nm_uuid VARCHAR(255);

-- Create index for performance
CREATE INDEX idx_products_category_id ON products(category_id);
