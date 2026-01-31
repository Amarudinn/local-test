-- ============================================================================
-- COMPLETE DATABASE SETUP - Debate Room (Fresh Install)
-- ============================================================================
-- Run this ONCE on a fresh/empty Supabase database
-- Includes: All tables + Real-time AI Evaluation System (6 Criteria)
-- 
-- Scoring:
--   - Logic & Reasoning: 25%
--   - Evidence & Facts: 20% 
--   - Clarity: 15%
--   - Relevance: 15%
--   - Originality: 15% (NEW)
--   - Persuasiveness: 10% (NEW)
-- ============================================================================

-- ============================================================================
-- 1. HELPER FUNCTION: Auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. DEBATES TABLE
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

CREATE INDEX idx_debates_contract_address ON debates(contract_address);
CREATE INDEX idx_debates_status ON debates(status);
CREATE INDEX idx_debates_created_at ON debates(created_at DESC);
CREATE INDEX idx_debates_end_time ON debates(end_time);

COMMENT ON TABLE debates IS 'Caches debate metadata from blockchain smart contracts';

-- ============================================================================
-- 3. PARTICIPANTS TABLE
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

CREATE INDEX idx_participants_debate_id ON participants(debate_id);
CREATE INDEX idx_participants_contract_address ON participants(contract_address);
CREATE INDEX idx_participants_participant_address ON participants(participant_address);

COMMENT ON TABLE participants IS 'Caches participant data from blockchain';

-- ============================================================================
-- 4. ARGUMENTS TABLE
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

CREATE INDEX idx_arguments_debate_id ON arguments(debate_id);
CREATE INDEX idx_arguments_contract_address ON arguments(contract_address);
CREATE INDEX idx_arguments_author_address ON arguments(author_address);

COMMENT ON TABLE arguments IS 'Caches argument submissions from blockchain';

-- ============================================================================
-- 5. LEADERBOARD_RESULTS TABLE (6 Criteria Scoring)
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
  -- 6 Criteria Scoring (NEW)
  logic_reasoning INTEGER NOT NULL DEFAULT 0,
  evidence_facts INTEGER NOT NULL DEFAULT 0,
  clarity INTEGER NOT NULL DEFAULT 0,
  relevance INTEGER NOT NULL DEFAULT 0,
  originality INTEGER NOT NULL DEFAULT 0,
  persuasiveness INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_debate_participant_result UNIQUE (debate_id, participant_address)
);

CREATE INDEX idx_leaderboard_debate_id ON leaderboard_results(debate_id);
CREATE INDEX idx_leaderboard_contract_address ON leaderboard_results(contract_address);
CREATE INDEX idx_leaderboard_score ON leaderboard_results(score DESC);

COMMENT ON TABLE leaderboard_results IS 'Caches AI judging results from blockchain';

-- ============================================================================
-- 6. SYNC_QUEUE TABLE
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

CREATE INDEX idx_sync_queue_status_next_retry ON sync_queue(status, next_retry_at) WHERE status = 'pending';
CREATE INDEX idx_sync_queue_contract_address ON sync_queue(contract_address);

COMMENT ON TABLE sync_queue IS 'Queue for background sync operations';

-- ============================================================================
-- 7. EVALUATION_QUEUE TABLE (Real-time AI Evaluation)
-- ============================================================================

CREATE TABLE evaluation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  contract_address TEXT NOT NULL,
  participant_address TEXT NOT NULL,
  argument_content TEXT NOT NULL,
  debate_topic TEXT NOT NULL,
  debate_description TEXT NOT NULL,
  
  -- Queue status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  
  -- Error handling
  last_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  CONSTRAINT unique_evaluation_queue_entry UNIQUE (debate_id, participant_address)
);

CREATE INDEX idx_evaluation_queue_status ON evaluation_queue(status);
CREATE INDEX idx_evaluation_queue_priority ON evaluation_queue(priority, created_at);
CREATE INDEX idx_evaluation_queue_debate ON evaluation_queue(debate_id);
CREATE INDEX idx_evaluation_queue_contract ON evaluation_queue(contract_address);

COMMENT ON TABLE evaluation_queue IS 'Queue for pending AI argument evaluations';

-- ============================================================================
-- 8. EVALUATIONS TABLE (AI Results - Hidden until reveal)
-- ============================================================================

CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  contract_address TEXT NOT NULL,
  participant_address TEXT NOT NULL,
  
  -- Scores (6 criteria)
  total_score INTEGER NOT NULL CHECK (total_score >= 0 AND total_score <= 100),
  logic_reasoning INTEGER NOT NULL CHECK (logic_reasoning >= 0 AND logic_reasoning <= 25),
  evidence_facts INTEGER NOT NULL CHECK (evidence_facts >= 0 AND evidence_facts <= 20),
  clarity INTEGER NOT NULL CHECK (clarity >= 0 AND clarity <= 15),
  relevance INTEGER NOT NULL CHECK (relevance >= 0 AND relevance <= 15),
  originality INTEGER NOT NULL CHECK (originality >= 0 AND originality <= 15),
  persuasiveness INTEGER NOT NULL CHECK (persuasiveness >= 0 AND persuasiveness <= 10),
  
  -- AI reasoning
  reasoning TEXT NOT NULL,
  
  -- Visibility control (hidden until debate ends)
  is_visible BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  revealed_at TIMESTAMPTZ,
  
  CONSTRAINT unique_evaluation_entry UNIQUE (debate_id, participant_address)
);

CREATE INDEX idx_evaluations_debate ON evaluations(debate_id);
CREATE INDEX idx_evaluations_contract ON evaluations(contract_address);
CREATE INDEX idx_evaluations_visible ON evaluations(is_visible);
CREATE INDEX idx_evaluations_score ON evaluations(total_score DESC);

COMMENT ON TABLE evaluations IS 'Stores AI evaluation results for arguments (hidden until reveal)';

-- ============================================================================
-- 9. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE debates ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE arguments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 10. RLS POLICIES (Public Access)
-- ============================================================================

-- Debates
CREATE POLICY "Debates are viewable by everyone" ON debates FOR SELECT USING (true);
CREATE POLICY "Anyone can create debates" ON debates FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update debates" ON debates FOR UPDATE USING (true);

-- Participants
CREATE POLICY "Participants are viewable by everyone" ON participants FOR SELECT USING (true);
CREATE POLICY "Anyone can join debates" ON participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update participants" ON participants FOR UPDATE USING (true);

-- Arguments
CREATE POLICY "Arguments are viewable by everyone" ON arguments FOR SELECT USING (true);
CREATE POLICY "Anyone can submit arguments" ON arguments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update arguments" ON arguments FOR UPDATE USING (true);

-- Leaderboard
CREATE POLICY "Leaderboard is viewable by everyone" ON leaderboard_results FOR SELECT USING (true);
CREATE POLICY "Anyone can insert leaderboard results" ON leaderboard_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update leaderboard results" ON leaderboard_results FOR UPDATE USING (true);

-- Sync queue
CREATE POLICY "Sync queue is viewable by everyone" ON sync_queue FOR SELECT USING (true);
CREATE POLICY "Anyone can queue sync jobs" ON sync_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update sync jobs" ON sync_queue FOR UPDATE USING (true);

-- Evaluation queue
CREATE POLICY "Evaluation queue is viewable by everyone" ON evaluation_queue FOR SELECT USING (true);
CREATE POLICY "Anyone can queue evaluations" ON evaluation_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update evaluation queue" ON evaluation_queue FOR UPDATE USING (true);

-- Evaluations
CREATE POLICY "Evaluations are viewable by everyone" ON evaluations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert evaluations" ON evaluations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update evaluations" ON evaluations FOR UPDATE USING (true);

-- ============================================================================
-- 11. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON debates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON participants TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON arguments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON leaderboard_results TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON sync_queue TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON evaluation_queue TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON evaluations TO anon, authenticated;

-- ============================================================================
-- 12. TRIGGERS (Auto-update updated_at)
-- ============================================================================

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

CREATE TRIGGER evaluations_updated_at BEFORE UPDATE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 13. VERIFICATION
-- ============================================================================

SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
