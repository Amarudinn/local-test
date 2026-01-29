-- Create participants table for caching
-- This table caches participant data from blockchain smart contracts
-- Requirements: 11.2

CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  wallet_address TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  has_submitted BOOLEAN DEFAULT false,
  CONSTRAINT unique_debate_participant UNIQUE (debate_id, wallet_address)
);

-- Create index on debate_id for fast lookups of participants by debate
CREATE INDEX IF NOT EXISTS idx_participants_debate_id ON participants(debate_id);

-- Create index on user_id for finding debates a user has joined
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);

-- Create index on wallet_address for finding participants by wallet
CREATE INDEX IF NOT EXISTS idx_participants_wallet_address ON participants(wallet_address);

-- Add comments for documentation
COMMENT ON TABLE participants IS 'Caches participant data from blockchain smart contracts';
COMMENT ON COLUMN participants.id IS 'Primary key UUID';
COMMENT ON COLUMN participants.debate_id IS 'Foreign key to debates table (CASCADE DELETE)';
COMMENT ON COLUMN participants.user_id IS 'Foreign key to users table (nullable for non-registered users)';
COMMENT ON COLUMN participants.wallet_address IS 'Participant wallet address';
COMMENT ON COLUMN participants.joined_at IS 'Timestamp when the participant joined the debate';
COMMENT ON COLUMN participants.has_submitted IS 'Flag indicating if participant has submitted an argument';
COMMENT ON CONSTRAINT unique_debate_participant ON participants IS 'Ensures each wallet can only join a debate once';
