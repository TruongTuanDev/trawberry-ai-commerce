ALTER TABLE payment_confirmations
ADD COLUMN IF NOT EXISTS review_note TEXT;
