CREATE TABLE IF NOT EXISTS ai_generation_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  mode VARCHAR(50) NOT NULL DEFAULT 'generate',
  quantity INTEGER NOT NULL DEFAULT 1,
  prompt TEXT NOT NULL,
  negative_prompt TEXT NULL,
  style_preset VARCHAR(255) NULL,
  source_image_id UUID NULL REFERENCES product_images(id) ON DELETE SET NULL,
  credit_cost INTEGER NOT NULL DEFAULT 1,
  credit_refunded_at TIMESTAMPTZ NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  queue_job_id VARCHAR(255) NULL,
  provider_task_id VARCHAR(255) NULL,
  error_message TEXT NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_generation_tasks_shop_status_created_at
  ON ai_generation_tasks(shop_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_generation_tasks_product_created_at
  ON ai_generation_tasks(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS seller_ai_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  last_granted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_generated_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES ai_generation_tasks(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url VARCHAR(1000) NOT NULL,
  thumbnail_url VARCHAR(1000) NULL,
  storage_provider VARCHAR(100) NULL,
  mime_type VARCHAR(100) NULL,
  width INTEGER NULL,
  height INTEGER NULL,
  metadata JSONB NULL,
  attached_image_id UUID NULL UNIQUE REFERENCES product_images(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_generated_images_product_created_at
  ON ai_generated_images(product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  task_id UUID NULL REFERENCES ai_generation_tasks(id) ON DELETE SET NULL,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  credit_delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_shop_created_at
  ON ai_usage_logs(shop_id, created_at DESC);
