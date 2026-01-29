-- ============================================
-- Create Sync Queue Table for Background Jobs
-- ============================================
-- This table stores failed sync operations that need to be retried
-- by a background job (cron or serverless function)

CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Sync operation type
  sync_type TEXT NOT NULL CHECK (sync_type IN ('debate_creation', 'participant_join', 'debate_resolution')),
  
  -- Contract and participant info
  contract_address TEXT NOT NULL,
  participant_address TEXT, -- NULL for debate_creation and debate_resolution
  
  -- Data payload (JSON)
  payload JSONB NOT NULL,
  
  -- Retry tracking
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 10,
  next_retry_at TIMESTAMPTZ NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Error tracking
  last_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for efficient querying
CREATE INDEX idx_sync_queue_status_next_retry ON sync_queue(status, next_retry_at) 
  WHERE status = 'pending';

CREATE INDEX idx_sync_queue_contract_address ON sync_queue(contract_address);

CREATE INDEX idx_sync_queue_created_at ON sync_queue(created_at DESC);

-- Enable RLS
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (for monitoring)
CREATE POLICY "Sync queue is viewable by everyone"
  ON sync_queue FOR SELECT
  USING (true);

-- Allow anyone to insert (for queueing failed syncs)
CREATE POLICY "Anyone can queue sync jobs"
  ON sync_queue FOR INSERT
  WITH CHECK (true);

-- Allow anyone to update (for background job processing)
CREATE POLICY "Anyone can update sync jobs"
  ON sync_queue FOR UPDATE
  USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON sync_queue TO anon, authenticated;

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_sync_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_queue_updated_at
  BEFORE UPDATE ON sync_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_queue_updated_at();

-- ============================================
-- Notes:
-- ============================================
-- 
-- This table enables reliable background sync for slow blockchains like GenLayer.
-- 
-- Workflow:
-- 1. Quick retry fails (3 attempts × 5 seconds = 15 seconds)
-- 2. Operation queued to sync_queue table
-- 3. Background job (cron/serverless) processes queue every 1-5 minutes
-- 4. Background job retries with longer delays (1-2 minutes between attempts)
-- 5. After max_attempts, mark as 'failed' for manual review
--
-- Background Job Implementation Options:
-- - Vercel Cron Jobs (vercel.json)
-- - Next.js API Route with cron trigger
-- - Supabase Edge Functions with pg_cron
-- - External cron service (EasyCron, cron-job.org)
--
