-- ============================================================================
-- Migration: Create Evaluation System Tables
-- ============================================================================
-- Creates tables for real-time AI evaluation with queue processing
-- 
-- New tables:
--   - evaluation_queue: Queue for pending argument evaluations
--   - evaluations: Stores AI evaluation results (hidden until debate ends)
--
-- Changes to existing tables:
--   - leaderboard_results: Replace rebuttal_quality with originality + persuasiveness

-- ============================================================================
-- Create evaluation_queue table
-- ============================================================================

CREATE TABLE IF NOT EXISTS evaluation_queue (
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
  
  -- Unique constraint to prevent duplicate queue entries
  CONSTRAINT unique_evaluation_queue_entry UNIQUE (debate_id, participant_address)
);

-- Indexes for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_evaluation_queue_status ON evaluation_queue(status);
CREATE INDEX IF NOT EXISTS idx_evaluation_queue_priority ON evaluation_queue(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_evaluation_queue_debate ON evaluation_queue(debate_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_queue_contract ON evaluation_queue(contract_address);

-- Comments
COMMENT ON TABLE evaluation_queue IS 'Queue for pending AI argument evaluations';
COMMENT ON COLUMN evaluation_queue.status IS 'pending, processing, completed, or failed';
COMMENT ON COLUMN evaluation_queue.priority IS 'Lower number = higher priority (0 is default)';

-- ============================================================================
-- Create evaluations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  contract_address TEXT NOT NULL,
  participant_address TEXT NOT NULL,
  
  -- Scores (6 criteria - new scoring system)
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
  
  -- Unique constraint
  CONSTRAINT unique_evaluation_entry UNIQUE (debate_id, participant_address)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evaluations_debate ON evaluations(debate_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_contract ON evaluations(contract_address);
CREATE INDEX IF NOT EXISTS idx_evaluations_visible ON evaluations(is_visible);
CREATE INDEX IF NOT EXISTS idx_evaluations_score ON evaluations(total_score DESC);

-- Comments
COMMENT ON TABLE evaluations IS 'Stores AI evaluation results for arguments';
COMMENT ON COLUMN evaluations.is_visible IS 'FALSE until debate ends, then TRUE to reveal scores';

-- ============================================================================
-- Update leaderboard_results table (add new columns, keep old for compatibility)
-- ============================================================================

-- Add new columns if they don't exist
ALTER TABLE leaderboard_results 
  ADD COLUMN IF NOT EXISTS originality INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS persuasiveness INTEGER NOT NULL DEFAULT 0;

-- ============================================================================
-- Enable RLS
-- ============================================================================

ALTER TABLE evaluation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Evaluation queue policies
CREATE POLICY "Evaluation queue is viewable by everyone" 
  ON evaluation_queue FOR SELECT USING (true);
CREATE POLICY "Anyone can queue evaluations" 
  ON evaluation_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update evaluation queue" 
  ON evaluation_queue FOR UPDATE USING (true);

-- Evaluations policies (only visible ones are public, but we allow all for now)
CREATE POLICY "Evaluations are viewable by everyone" 
  ON evaluations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert evaluations" 
  ON evaluations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update evaluations" 
  ON evaluations FOR UPDATE USING (true);

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON evaluation_queue TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON evaluations TO anon, authenticated;

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

CREATE TRIGGER evaluations_updated_at 
  BEFORE UPDATE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('evaluation_queue', 'evaluations')
ORDER BY table_name;
