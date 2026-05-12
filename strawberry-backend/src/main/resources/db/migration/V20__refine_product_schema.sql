-- Refine product schema with strict WB vs Local separation
-- 1. Rename existing fields to follow wb_* naming convention
ALTER TABLE products RENAME COLUMN title TO wb_title;
ALTER TABLE products RENAME COLUMN description TO wb_description;
ALTER TABLE products RENAME COLUMN wb_vendor_code TO wb_vendor_code_old; -- Just in case
ALTER TABLE products RENAME COLUMN wb_vendor_code_old TO wb_vendor_code;
-- Note: category_name, wb_created_at, wb_updated_at are already well named or acceptable.

-- 2. Add new Wildberries root fields
ALTER TABLE products 
ADD COLUMN wb_video_url TEXT,
ADD COLUMN wb_need_kiz BOOLEAN DEFAULT FALSE;

-- 3. Add wholesale support
ALTER TABLE products
ADD COLUMN wholesale_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN wholesale_quantum INTEGER;

-- 4. Add dimensions
ALTER TABLE products
ADD COLUMN length INTEGER,
ADD COLUMN width INTEGER,
ADD COLUMN height INTEGER,
ADD COLUMN weight_brutto INTEGER,
ADD COLUMN dimensions_valid BOOLEAN DEFAULT FALSE;

-- 5. Add denormalized rating fields (if not already strictly present from V18)
-- V18 already added average_rating and feedback_count.
-- We'll ensure they are present and renamed if necessary, but naming is already okay.
-- Ensure we have local_title and local_description (already in V5)
