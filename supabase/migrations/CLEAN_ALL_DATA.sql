-- ============================================================================
-- CLEAN ALL DATA - Reset Database for Fresh Testing
-- ============================================================================
-- WARNING: This will DROP and RECREATE ALL tables with the latest schema.
-- ALL DATA WILL BE PERMANENTLY DELETED. Use with caution!
-- 
-- Purpose: Clean slate for testing with updated schema (including breakdown columns)
-- Usage: Run this script in Supabase SQL Editor
-- ============================================================================

-- Step 1: Drop all tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS leaderboard_results CASCADE;
DROP TABLE IF EXISTS arguments CASCADE;
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS sync_queue CASCADE;
DROP TABLE IF EXISTS debates CASCADE;

-- Step 2: Recreate debates table
CREATE TABLE debates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_address TEXT UNIQUE NOT NULL,
  topic TEXT NOT NULL,
  description TEXT NOT NULL,
  duration_hours INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ONGOING', 'ENDED', 'RESOLVED')),
  participant_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_debates_contract_address ON debates(contract_address);
CREATE INDEX idx_debates_status ON debates(status);
CREATE INDEX idx_debates_created_at ON debates(created_at DESC);
CREATE INDEX idx_debates_end_time ON debates(end_time);
CREATE INDEX idx_debates_last_synced ON debates(last_synced_at);

-- Step 3: Recreate arguments table
CREATE TABLE arguments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debate_id UUID REFERENCES debates(id) ON DELETE CASCADE,
  contract_address TEXT NOT NULL,
  author_address TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_argument_per_author UNIQUE(debate_id, author_address)
);

CREATE INDEX idx_arguments_debate_id ON arguments(debate_id);
CREATE INDEX idx_arguments_contract_address ON arguments(contract_address);
CREATE INDEX idx_arguments_author ON arguments(author_address);
CREATE INDEX idx_arguments_timestamp ON arguments(timestamp);

-- Step 4: Recreate participants table
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debate_id UUID REFERENCES debates(id) ON DELETE CASCADE,
  contract_address TEXT NOT NULL,
  participant_address TEXT NOT NULL,
  joined_at BIGINT NOT NULL,
  has_submitted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_participant_per_debate UNIQUE(debate_id, participant_address)
);

CREATE INDEX idx_participants_debate_id ON participants(debate_id);
CREATE INDEX idx_participants_contract_address ON participants(contract_address);
CREATE INDEX idx_participants_address ON participants(participant_address);
CREATE INDEX idx_participants_joined_at ON participants(joined_at);

-- Step 5: Recreate leaderboard_results table WITH BREAKDOWN COLUMNS
CREATE TABLE leaderboard_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debate_id UUID REFERENCES debates(id) ON DELETE CASCADE,
  contract_address TEXT NOT NULL,
  participant_address TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  reasoning TEXT NOT NULL,
  rank INTEGER,
  is_winner BOOLEAN DEFAULT false,
  logic_reasoning INTEGER CHECK (logic_reasoning >= 0 AND logic_reasoning <= 30),
  evidence_facts INTEGER CHECK (evidence_facts >= 0 AND evidence_facts <= 25),
  clarity INTEGER CHECK (clarity >= 0 AND clarity <= 15),
  rebuttal_quality INTEGER CHECK (rebuttal_quality >= 0 AND rebuttal_quality <= 20),
  relevance INTEGER CHECK (relevance >= 0 AND relevance <= 10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_result_per_participant UNIQUE(debate_id, participant_address)
);

CREATE INDEX idx_leaderboard_debate_id ON leaderboard_results(debate_id);
CREATE INDEX idx_leaderboard_contract_address ON leaderboard_results(contract_address);
CREATE INDEX idx_leaderboard_participant ON leaderboard_results(participant_address);
CREATE INDEX idx_leaderboard_score ON leaderboard_results(score DESC);
CREATE INDEX idx_leaderboard_rank ON leaderboard_results(rank);
CREATE INDEX idx_leaderboard_winner ON leaderboard_results(is_winner) WHERE is_winner = true;

-- Step 6: Recreate sync_queue table
CREATE TABLE sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_address TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  next_retry_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_sync_queue_status ON sync_queue(status);
CREATE INDEX idx_sync_queue_contract ON sync_queue(contract_address);
CREATE INDEX idx_sync_queue_next_retry ON sync_queue(next_retry_at) WHERE status = 'pending';

-- Step 7: Enable RLS on all tables
ALTER TABLE debates ENABLE ROW LEVEL SECURITY;
ALTER TABLE arguments ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS policies (public read access)
CREATE POLICY "Debates are viewable by everyone" ON debates FOR SELECT USING (true);
CREATE POLICY "Debates can be inserted by anyone" ON debates FOR INSERT WITH CHECK (true);
CREATE POLICY "Debates can be updated by anyone" ON debates FOR UPDATE USING (true);

CREATE POLICY "Arguments are viewable by everyone" ON arguments FOR SELECT USING (true);
CREATE POLICY "Arguments can be inserted by anyone" ON arguments FOR INSERT WITH CHECK (true);

CREATE POLICY "Participants are viewable by everyone" ON participants FOR SELECT USING (true);
CREATE POLICY "Participants can be inserted by anyone" ON participants FOR INSERT WITH CHECK (true);

CREATE POLICY "Leaderboard results are viewable by everyone" ON leaderboard_results FOR SELECT USING (true);
CREATE POLICY "Leaderboard results can be inserted by anyone" ON leaderboard_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Leaderboard results can be updated by anyone" ON leaderboard_results FOR UPDATE USING (true);

CREATE POLICY "Sync queue is viewable by everyone" ON sync_queue FOR SELECT USING (true);
CREATE POLICY "Sync queue can be inserted by anyone" ON sync_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Sync queue can be updated by anyone" ON sync_queue FOR UPDATE USING (true);

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check table structure
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leaderboard_results'
ORDER BY ordinal_position;

-- Check counts (should all be 0)
SELECT 
  (SELECT COUNT(*) FROM debates) as debates_count,
  (SELECT COUNT(*) FROM arguments) as arguments_count,
  (SELECT COUNT(*) FROM participants) as participants_count,
  (SELECT COUNT(*) FROM leaderboard_results) as leaderboard_count,
  (SELECT COUNT(*) FROM sync_queue) as sync_queue_count;

-- ============================================================================
-- INSTRUCTIONS FOR USER
-- ============================================================================
-- 
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Copy and paste this entire script
-- 4. Click "Run" to execute
-- 5. Verify all counts are 0 and leaderboard_results has breakdown columns
-- 6. Deploy new contract with breakdown support
-- 7. Create a new debate and test the full flow
-- 
-- ============================================================================
