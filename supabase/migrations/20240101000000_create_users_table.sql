-- Create users table with Privy integration fields
-- This table stores user authentication data from Privy
-- Requirements: 1.2, 1.3

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_user_id TEXT UNIQUE NOT NULL,
  wallet_address TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on privy_user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_privy_user_id ON users(privy_user_id);

-- Create index on wallet_address for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

-- Add comments for documentation
COMMENT ON TABLE users IS 'Stores user authentication data from Privy';
COMMENT ON COLUMN users.id IS 'Primary key UUID';
COMMENT ON COLUMN users.privy_user_id IS 'Unique identifier from Privy authentication system';
COMMENT ON COLUMN users.wallet_address IS 'Primary wallet address associated with the user';
COMMENT ON COLUMN users.email IS 'Email address if authenticated via email';
COMMENT ON COLUMN users.created_at IS 'Timestamp when the user account was created';
