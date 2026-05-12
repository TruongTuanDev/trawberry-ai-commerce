-- Add scheduler and health metrics to shop_wb_integrations
ALTER TABLE shop_wb_integrations 
ADD COLUMN sync_interval_minutes INTEGER NOT NULL DEFAULT 360,
ADD COLUMN is_sync_paused BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN next_sync_expected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN consecutive_failure_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN last_sync_duration_ms BIGINT;

-- Add check constraint for sync_interval_minutes (15 min to 24 hours)
ALTER TABLE shop_wb_integrations DROP CONSTRAINT IF EXISTS chk_sync_interval;
ALTER TABLE shop_wb_integrations ADD CONSTRAINT chk_sync_interval CHECK (sync_interval_minutes >= 15 AND sync_interval_minutes <= 1440);

-- Update sync_jobs to include refined metrics
ALTER TABLE sync_jobs
ADD COLUMN trigger_type VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
ADD COLUMN duration_ms BIGINT;

-- Ensure sync_type is already present or add it (V4 already has it, but let's be safe if it needs refinement)
-- V4 had sync_type, but let's ensure it's not null and has defaults
ALTER TABLE sync_jobs ALTER COLUMN sync_type SET NOT NULL;

-- Create index for scheduler performance
CREATE INDEX idx_wb_integration_scheduler ON shop_wb_integrations (is_active, is_sync_paused, next_sync_expected_at);
