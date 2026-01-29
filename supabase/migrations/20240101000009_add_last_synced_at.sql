-- Migration: Add last_synced_at column to debates table
-- Purpose: Track when debate data was last synced from blockchain
-- This enables smart caching and reduces unnecessary blockchain requests

-- Add last_synced_at column
ALTER TABLE debates 
ADD COLUMN last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for faster queries on last_synced_at
CREATE INDEX idx_debates_last_synced_at ON debates(last_synced_at);

-- Add comment for documentation
COMMENT ON COLUMN debates.last_synced_at IS 'Timestamp of last sync from blockchain to database';
