-- Add image_url column to debates table
ALTER TABLE debates ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Comment on column
COMMENT ON COLUMN debates.image_url IS 'Optional URL for debate cover image (IPFS via Pinata)';
