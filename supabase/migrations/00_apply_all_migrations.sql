-- Combined Migration Script: Apply All Tables
-- This script creates all tables in the correct order
-- Run this file to set up the complete database schema

-- ============================================================================
-- MIGRATION 1: Create users table
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_user_id TEXT UNIQUE NOT NULL,
  wallet_address TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_privy_user_id ON users(privy_user_id);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

COMMENT ON TABLE users IS 'Stores user authentication data from Privy';
COMMENT ON COLUMN users.id IS 'Primary key UUID';
COMMENT ON COLUMN users.privy_user_id IS 'Unique identifier from Privy authentication system';
COMMENT ON COLUMN users.wallet_address IS 'Primary wallet address associated with the user';
COMMENT ON COLUMN users.email IS 'Email address if authenticated via email';
COMMENT ON COLUMN users.created_at IS 'Timestamp when the user account was created';

-- ============================================================================
-- MIGRATION 2: Create debates table
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS idx_debates_contract_address ON debates(contract_address);
CREATE INDEX IF NOT EXISTS idx_debates_status ON debates(status);
CREATE INDEX IF NOT EXISTS idx_debates_created_at ON debates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debates_creator_id ON debates(creator_id);
CREATE INDEX IF NOT EXISTS idx_debates_end_time ON debates(end_time);

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

-- ============================================================================
-- MIGRATION 3: Create participants table
-- ============================================================================

CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  wallet_address TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  has_submitted BOOLEAN DEFAULT false,
  CONSTRAINT unique_debate_participant UNIQUE (debate_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_participants_debate_id ON participants(debate_id);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_wallet_address ON participants(wallet_address);

COMMENT ON TABLE participants IS 'Caches participant data from blockchain smart contracts';
COMMENT ON COLUMN participants.id IS 'Primary key UUID';
COMMENT ON COLUMN participants.debate_id IS 'Foreign key to debates table (CASCADE DELETE)';
COMMENT ON COLUMN participants.user_id IS 'Foreign key to users table (nullable for non-registered users)';
COMMENT ON COLUMN participants.wallet_address IS 'Participant wallet address';
COMMENT ON COLUMN participants.joined_at IS 'Timestamp when the participant joined the debate';
COMMENT ON COLUMN participants.has_submitted IS 'Flag indicating if participant has submitted an argument';
COMMENT ON CONSTRAINT unique_debate_participant ON participants IS 'Ensures each wallet can only join a debate once';

-- ============================================================================
-- MIGRATION 4: Create arguments table
-- ============================================================================

CREATE TABLE IF NOT EXISTS arguments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id),
  content TEXT NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arguments_debate_id ON arguments(debate_id);
CREATE INDEX IF NOT EXISTS idx_arguments_participant_id ON arguments(participant_id);
CREATE INDEX IF NOT EXISTS idx_arguments_submitted_at ON arguments(submitted_at);

COMMENT ON TABLE arguments IS 'Caches argument submissions from blockchain smart contracts';
COMMENT ON COLUMN arguments.id IS 'Primary key UUID';
COMMENT ON COLUMN arguments.debate_id IS 'Foreign key to debates table (CASCADE DELETE)';
COMMENT ON COLUMN arguments.participant_id IS 'Foreign key to participants table';
COMMENT ON COLUMN arguments.content IS 'Argument text content (max 500 characters)';
COMMENT ON COLUMN arguments.submitted_at IS 'Timestamp when the argument was submitted';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verify tables were created
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'debates', 'participants', 'arguments')
ORDER BY table_name;
