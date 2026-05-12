ALTER TABLE seller_profiles
ADD COLUMN IF NOT EXISTS current_shop_id UUID;
