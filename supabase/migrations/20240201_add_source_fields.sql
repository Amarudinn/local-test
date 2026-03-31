-- ============================================================================
-- Migration: Add source fields to debates table
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Add source columns to debates table
ALTER TABLE debates ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual' CHECK (source_type IN ('manual', 'tweet'));
ALTER TABLE debates ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE debates ADD COLUMN IF NOT EXISTS source_content TEXT;

-- Index for filtering by source type
CREATE INDEX IF NOT EXISTS idx_debates_source_type ON debates(source_type);

-- Comments
COMMENT ON COLUMN debates.source_type IS 'Source of debate: manual or tweet';
COMMENT ON COLUMN debates.source_url IS 'Original source URL (e.g., tweet URL)';
COMMENT ON COLUMN debates.source_content IS 'Snapshot of source content at creation time';
