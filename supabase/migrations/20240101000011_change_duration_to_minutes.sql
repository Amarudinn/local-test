-- ============================================================================
-- Change duration_hours to duration_minutes
-- ============================================================================
-- This migration changes the debates table to use minutes instead of hours
-- for duration, matching the contract's duration_minutes parameter

-- Add new column duration_minutes
ALTER TABLE debates ADD COLUMN duration_minutes INTEGER;

-- Copy data from duration_hours to duration_minutes (convert hours to minutes)
UPDATE debates SET duration_minutes = duration_hours * 60;

-- Make duration_minutes NOT NULL
ALTER TABLE debates ALTER COLUMN duration_minutes SET NOT NULL;

-- Drop old column
ALTER TABLE debates DROP COLUMN duration_hours;

-- Add comment
COMMENT ON COLUMN debates.duration_minutes IS 'Debate duration in minutes (matches contract parameter)';
