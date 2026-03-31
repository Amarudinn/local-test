-- ============================================================================
-- Migration: Add Score Breakdown to Leaderboard Results
-- Description: Add detailed score breakdown columns for each evaluation criterion
-- Date: 2024-01-01
-- ============================================================================

-- Add breakdown columns to leaderboard_results table
ALTER TABLE leaderboard_results
ADD COLUMN IF NOT EXISTS logic_reasoning INTEGER CHECK (logic_reasoning >= 0 AND logic_reasoning <= 30),
ADD COLUMN IF NOT EXISTS evidence_facts INTEGER CHECK (evidence_facts >= 0 AND evidence_facts <= 25),
ADD COLUMN IF NOT EXISTS clarity INTEGER CHECK (clarity >= 0 AND clarity <= 15),
ADD COLUMN IF NOT EXISTS rebuttal_quality INTEGER CHECK (rebuttal_quality >= 0 AND rebuttal_quality <= 20),
ADD COLUMN IF NOT EXISTS relevance INTEGER CHECK (relevance >= 0 AND relevance <= 10);

-- Add comment to explain the breakdown columns
COMMENT ON COLUMN leaderboard_results.logic_reasoning IS 'Logic & Reasoning score (0-30 points, 30% weight)';
COMMENT ON COLUMN leaderboard_results.evidence_facts IS 'Evidence & Facts score (0-25 points, 25% weight)';
COMMENT ON COLUMN leaderboard_results.clarity IS 'Clarity score (0-15 points, 15% weight)';
COMMENT ON COLUMN leaderboard_results.rebuttal_quality IS 'Rebuttal Quality score (0-20 points, 20% weight)';
COMMENT ON COLUMN leaderboard_results.relevance IS 'Relevance score (0-10 points, 10% weight)';

-- Note: Total score should equal sum of all breakdown scores (max 100)
