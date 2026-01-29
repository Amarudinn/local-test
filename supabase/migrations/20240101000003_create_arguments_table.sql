-- Create arguments table for caching
-- This table caches argument submissions from blockchain smart contracts
-- Requirements: 11.2

CREATE TABLE IF NOT EXISTS arguments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id),
  content TEXT NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on debate_id for fast lookups of arguments by debate
CREATE INDEX IF NOT EXISTS idx_arguments_debate_id ON arguments(debate_id);

-- Create index on participant_id for finding arguments by participant
CREATE INDEX IF NOT EXISTS idx_arguments_participant_id ON arguments(participant_id);

-- Create index on submitted_at for sorting arguments chronologically
CREATE INDEX IF NOT EXISTS idx_arguments_submitted_at ON arguments(submitted_at);

-- Add comments for documentation
COMMENT ON TABLE arguments IS 'Caches argument submissions from blockchain smart contracts';
COMMENT ON COLUMN arguments.id IS 'Primary key UUID';
COMMENT ON COLUMN arguments.debate_id IS 'Foreign key to debates table (CASCADE DELETE)';
COMMENT ON COLUMN arguments.participant_id IS 'Foreign key to participants table';
COMMENT ON COLUMN arguments.content IS 'Argument text content (max 500 characters)';
COMMENT ON COLUMN arguments.submitted_at IS 'Timestamp when the argument was submitted';
