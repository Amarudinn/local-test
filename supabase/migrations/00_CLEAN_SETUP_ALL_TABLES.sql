-- ============================================================================
-- CLEAN SETUP: Create All Tables (No Users Table)
-- ============================================================================
-- This script creates all tables without the users table
-- Application uses Privy for authentication (no database users)
-- Run this file to set up the complete database schema

-- ============================================================================
-- Drop existing tables if they exist (clean slate)
-- ============================================================================

DROP TABLE IF EXISTS leaderboard_results CASCADE;
DROP TABLE IF EXISTS arguments CASCADE;
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS sync_queue CASCADE;
DROP TABLE IF EXISTS debates CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- Create debates table (no creator_id)
-- ============================================================================

CREATE TABLE debates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_address TEXT UNIQUE NOT NULL,
  topic TEXT NOT NULL,
  description TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ONGOING', 'ENDED', 'RESOLVED')),
  participant_count INTEGER NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_debates_contract_address ON debates(contract_address);
CREATE INDEX idx_debates_status ON debates(status);
CREATE INDEX idx_debates_created_at ON debates(created_at DESC);
CREATE INDEX idx_debates_end_time ON debates(end_time);

-- Comments
COMMENT ON TABLE debates IS 'Caches debate metadata from blockchain smart contracts';
COMMENT ON COLUMN debates.contract_address IS 'Unique blockchain contract address';
COMMENT ON COLUMN debates.last_synced_at IS 'Last time data was synced from blockchain';

-- ============================================================================
-- Create participants table
-- ============================================================================

CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  contract_address TEXT NOT NULL,
  participant_address TEXT NOT NULL,
  joined_at BIGINT NOT NULL,
  has_submitted BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_debate_participant UNIQUE (debate_id, participant_address)
);

-- Indexes
CREATE INDEX idx_participants_debate_id ON participants(debate_id);
CREATE INDEX idx_participants_contract_address ON participants(contract_address);
CREATE INDEX idx_participants_participant_address ON participants(participant_address);

-- Comments
COMMENT ON TABLE participants IS 'Caches participant data from blockchain';
COMMENT ON COLUMN participants.joined_at IS 'Unix timestamp (BIGINT) from blockchain';

-- ============================================================================
-- Create arguments table
-- ============================================================================

CREATE TABLE arguments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  contract_address TEXT NOT NULL,
  author_address TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_debate_author UNIQUE (debate_id, author_address)
);

-- Indexes
CREATE INDEX idx_arguments_debate_id ON arguments(debate_id);
CREATE INDEX idx_arguments_contract_address ON arguments(contract_address);
CREATE INDEX idx_arguments_author_address ON arguments(author_address);

-- Comments
COMMENT ON TABLE arguments IS 'Caches argument submissions from blockchain';
COMMENT ON COLUMN arguments.timestamp IS 'Unix timestamp (BIGINT) from blockchain';

-- ============================================================================
-- Create leaderboard_results table
-- ============================================================================

CREATE TABLE leaderboard_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  contract_address TEXT NOT NULL,
  participant_address TEXT NOT NULL,
  score INTEGER NOT NULL,
  reasoning TEXT NOT NULL,
  rank INTEGER NOT NULL,
  is_winner BOOLEAN NOT NULL DEFAULT false,
  logic_reasoning INTEGER NOT NULL DEFAULT 0,
  evidence_facts INTEGER NOT NULL DEFAULT 0,
  clarity INTEGER NOT NULL DEFAULT 0,
  rebuttal_quality INTEGER NOT NULL DEFAULT 0,
  relevance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_debate_participant_result UNIQUE (debate_id, participant_address)
);

-- Indexes
CREATE INDEX idx_leaderboard_debate_id ON leaderboard_results(debate_id);
CREATE INDEX idx_leaderboard_contract_address ON leaderboard_results(contract_address);
CREATE INDEX idx_leaderboard_score ON leaderboard_results(score DESC);

-- Comments
COMMENT ON TABLE leaderboard_results IS 'Caches AI judging results from blockchain';

-- ============================================================================
-- Create sync_queue table
-- ============================================================================

CREATE TABLE sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('debate_creation', 'participant_join', 'debate_resolution')),
  contract_address TEXT NOT NULL,
  participant_address TEXT,
  payload JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 10,
  next_retry_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_sync_queue_status_next_retry ON sync_queue(status, next_retry_at) WHERE status = 'pending';
CREATE INDEX idx_sync_queue_contract_address ON sync_queue(contract_address);

-- Comments
COMMENT ON TABLE sync_queue IS 'Queue for background sync operations';

-- ============================================================================
-- Enable RLS (Row Level Security)
-- ============================================================================

ALTER TABLE debates ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE arguments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies (Public Access - No Authentication Required)
-- ============================================================================

-- Debates policies
CREATE POLICY "Debates are viewable by everyone" ON debates FOR SELECT USING (true);
CREATE POLICY "Anyone can create debates" ON debates FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update debates" ON debates FOR UPDATE USING (true);

-- Participants policies
CREATE POLICY "Participants are viewable by everyone" ON participants FOR SELECT USING (true);
CREATE POLICY "Anyone can join debates" ON participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update participants" ON participants FOR UPDATE USING (true);

-- Arguments policies
CREATE POLICY "Arguments are viewable by everyone" ON arguments FOR SELECT USING (true);
CREATE POLICY "Anyone can submit arguments" ON arguments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update arguments" ON arguments FOR UPDATE USING (true);

-- Leaderboard policies
CREATE POLICY "Leaderboard is viewable by everyone" ON leaderboard_results FOR SELECT USING (true);
CREATE POLICY "Anyone can insert leaderboard results" ON leaderboard_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update leaderboard results" ON leaderboard_results FOR UPDATE USING (true);

-- Sync queue policies
CREATE POLICY "Sync queue is viewable by everyone" ON sync_queue FOR SELECT USING (true);
CREATE POLICY "Anyone can queue sync jobs" ON sync_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update sync jobs" ON sync_queue FOR UPDATE USING (true);

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON debates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON participants TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON arguments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON leaderboard_results TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON sync_queue TO anon, authenticated;

-- ============================================================================
-- Auto-update updated_at triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER debates_updated_at BEFORE UPDATE ON debates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER participants_updated_at BEFORE UPDATE ON participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER arguments_updated_at BEFORE UPDATE ON arguments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER leaderboard_updated_at BEFORE UPDATE ON leaderboard_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER sync_queue_updated_at BEFORE UPDATE ON sync_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('debates', 'participants', 'arguments', 'leaderboard_results', 'sync_queue')
ORDER BY table_name;
