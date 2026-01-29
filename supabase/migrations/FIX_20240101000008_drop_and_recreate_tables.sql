-- FIX Migration: Drop old tables and create new ones with contract_address
-- Purpose: Fix conflict with existing participants/arguments tables
-- Date: 2024-01-26

-- ============================================================================
-- STEP 1: DROP OLD TABLES (if they exist)
-- ============================================================================

-- Drop old tables in correct order (child tables first, then parent)
DROP TABLE IF EXISTS arguments CASCADE;
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS leaderboard_results CASCADE;

-- ============================================================================
-- STEP 2: CREATE NEW ARGUMENTS TABLE
-- ============================================================================
CREATE TABLE arguments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debate_id UUID REFERENCES debates(id) ON DELETE CASCADE,
  contract_address TEXT NOT NULL,
  author_address TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one argument per participant per debate
  CONSTRAINT unique_argument_per_participant UNIQUE(debate_id, author_address)
);

-- Indexes for performance
CREATE INDEX idx_arguments_debate_id ON arguments(debate_id);
CREATE INDEX idx_arguments_contract_address ON arguments(contract_address);
CREATE INDEX idx_arguments_author ON arguments(author_address);
CREATE INDEX idx_arguments_timestamp ON arguments(timestamp);

-- RLS Policies for arguments
ALTER TABLE arguments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Arguments are viewable by everyone"
  ON arguments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert arguments"
  ON arguments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update arguments"
  ON arguments FOR UPDATE
  USING (true);

-- ============================================================================
-- STEP 3: CREATE NEW PARTICIPANTS TABLE
-- ============================================================================
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debate_id UUID REFERENCES debates(id) ON DELETE CASCADE,
  contract_address TEXT NOT NULL,
  participant_address TEXT NOT NULL,
  joined_at BIGINT NOT NULL,
  has_submitted BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one participant per debate
  CONSTRAINT unique_participant_per_debate UNIQUE(debate_id, participant_address)
);

-- Indexes for performance
CREATE INDEX idx_participants_debate_id ON participants(debate_id);
CREATE INDEX idx_participants_contract_address ON participants(contract_address);
CREATE INDEX idx_participants_address ON participants(participant_address);
CREATE INDEX idx_participants_joined_at ON participants(joined_at);

-- RLS Policies for participants
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants are viewable by everyone"
  ON participants FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert participants"
  ON participants FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update participants"
  ON participants FOR UPDATE
  USING (true);

-- ============================================================================
-- STEP 4: CREATE LEADERBOARD RESULTS TABLE
-- ============================================================================
CREATE TABLE leaderboard_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debate_id UUID REFERENCES debates(id) ON DELETE CASCADE,
  contract_address TEXT NOT NULL,
  participant_address TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  reasoning TEXT NOT NULL,
  rank INTEGER,
  is_winner BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one result per participant per debate
  CONSTRAINT unique_result_per_participant UNIQUE(debate_id, participant_address)
);

-- Indexes for performance
CREATE INDEX idx_leaderboard_debate_id ON leaderboard_results(debate_id);
CREATE INDEX idx_leaderboard_contract_address ON leaderboard_results(contract_address);
CREATE INDEX idx_leaderboard_participant ON leaderboard_results(participant_address);
CREATE INDEX idx_leaderboard_score ON leaderboard_results(score DESC);
CREATE INDEX idx_leaderboard_rank ON leaderboard_results(rank);
CREATE INDEX idx_leaderboard_winner ON leaderboard_results(is_winner) WHERE is_winner = true;

-- RLS Policies for leaderboard_results
ALTER TABLE leaderboard_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaderboard results are viewable by everyone"
  ON leaderboard_results FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert leaderboard results"
  ON leaderboard_results FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update leaderboard results"
  ON leaderboard_results FOR UPDATE
  USING (true);

-- ============================================================================
-- STEP 5: CREATE TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp (create if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for arguments
CREATE TRIGGER update_arguments_updated_at
  BEFORE UPDATE ON arguments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for participants
CREATE TRIGGER update_participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for leaderboard_results
CREATE TRIGGER update_leaderboard_results_updated_at
  BEFORE UPDATE ON leaderboard_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 6: ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE arguments IS 'Cache table for debate arguments from blockchain';
COMMENT ON TABLE participants IS 'Cache table for debate participants from blockchain';
COMMENT ON TABLE leaderboard_results IS 'Cache table for debate leaderboard results from blockchain';

COMMENT ON COLUMN arguments.debate_id IS 'Foreign key to debates table';
COMMENT ON COLUMN arguments.contract_address IS 'Blockchain contract address for this debate';
COMMENT ON COLUMN arguments.author_address IS 'Wallet address of the argument author';
COMMENT ON COLUMN arguments.content IS 'The argument text content';
COMMENT ON COLUMN arguments.timestamp IS 'Unix timestamp when argument was submitted';

COMMENT ON COLUMN participants.debate_id IS 'Foreign key to debates table';
COMMENT ON COLUMN participants.contract_address IS 'Blockchain contract address for this debate';
COMMENT ON COLUMN participants.participant_address IS 'Wallet address of the participant';
COMMENT ON COLUMN participants.joined_at IS 'Unix timestamp when participant joined';
COMMENT ON COLUMN participants.has_submitted IS 'Whether participant has submitted an argument';

COMMENT ON COLUMN leaderboard_results.debate_id IS 'Foreign key to debates table';
COMMENT ON COLUMN leaderboard_results.contract_address IS 'Blockchain contract address for this debate';
COMMENT ON COLUMN leaderboard_results.participant_address IS 'Wallet address of the participant';
COMMENT ON COLUMN leaderboard_results.score IS 'AI judge score (0-100)';
COMMENT ON COLUMN leaderboard_results.reasoning IS 'AI judge reasoning for the score';
COMMENT ON COLUMN leaderboard_results.rank IS 'Participant rank in leaderboard (1 = winner)';
COMMENT ON COLUMN leaderboard_results.is_winner IS 'Whether this participant is the winner';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify tables were created successfully
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'arguments') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'participants') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leaderboard_results') THEN
    RAISE NOTICE '✅ All tables created successfully!';
  ELSE
    RAISE EXCEPTION '❌ Some tables were not created';
  END IF;
END $$;
