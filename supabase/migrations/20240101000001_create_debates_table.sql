-- Create debates table with contract metadata
-- This table caches debate metadata from blockchain smart contracts
-- Requirements: 2.5, 11.1

CREATE TABLE IF NOT EXISTS debates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_address TEXT UNIQUE NOT NULL,
  creator_id UUID REFERENCES users(id),
  topic TEXT NOT NULL,
  description TEXT NOT NULL,
  duration_hours INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'ONGOING', 'ENDED', 'RESOLVED')),
  participant_count INTEGER DEFAULT 0,
  winner_address TEXT,
  winner_score INTEGER
);

-- Create index on contract_address for fast lookups
CREATE INDEX IF NOT EXISTS idx_debates_contract_address ON debates(contract_address);

-- Create index on status for filtering debates by status
CREATE INDEX IF NOT EXISTS idx_debates_status ON debates(status);

-- Create index on created_at for sorting debates by creation time
CREATE INDEX IF NOT EXISTS idx_debates_created_at ON debates(created_at DESC);

-- Create index on creator_id for finding debates by creator
CREATE INDEX IF NOT EXISTS idx_debates_creator_id ON debates(creator_id);

-- Create index on end_time for finding debates that have ended
CREATE INDEX IF NOT EXISTS idx_debates_end_time ON debates(end_time);

-- Add comments for documentation
COMMENT ON TABLE debates IS 'Caches debate metadata from blockchain smart contracts';
COMMENT ON COLUMN debates.id IS 'Primary key UUID';
COMMENT ON COLUMN debates.contract_address IS 'Unique blockchain contract address (0x...)';
COMMENT ON COLUMN debates.creator_id IS 'Foreign key to users table';
COMMENT ON COLUMN debates.topic IS 'Debate title (max 200 characters)';
COMMENT ON COLUMN debates.description IS 'Detailed debate description (max 1000 characters)';
COMMENT ON COLUMN debates.duration_hours IS 'Debate duration in hours';
COMMENT ON COLUMN debates.created_at IS 'Timestamp when the debate was created';
COMMENT ON COLUMN debates.end_time IS 'Calculated end timestamp (created_at + duration)';
COMMENT ON COLUMN debates.status IS 'Current debate status: OPEN, ONGOING, ENDED, or RESOLVED';
COMMENT ON COLUMN debates.participant_count IS 'Cached count of participants';
COMMENT ON COLUMN debates.winner_address IS 'Winner wallet address (after resolution)';
COMMENT ON COLUMN debates.winner_score IS 'Winner score 0-100 (after resolution)';
