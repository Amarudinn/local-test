-- ============================================
-- Enable Row Level Security (RLS) Policies
-- ============================================
-- This migration adds security policies to all tables
-- to prevent unauthorized access and modifications

-- ============================================
-- 1. Enable RLS on all tables
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE debates ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE arguments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. Users Table Policies
-- ============================================

-- Allow anyone to read user profiles (needed for displaying creator info)
CREATE POLICY "Users are viewable by everyone"
  ON users FOR SELECT
  USING (true);

-- Allow users to insert their own record (during registration)
CREATE POLICY "Users can insert their own record"
  ON users FOR INSERT
  WITH CHECK (true);

-- Allow users to update their own record only
CREATE POLICY "Users can update their own record"
  ON users FOR UPDATE
  USING (auth.uid()::text = id::text);

-- ============================================
-- 3. Debates Table Policies
-- ============================================

-- Allow anyone to read all debates (public platform)
CREATE POLICY "Debates are viewable by everyone"
  ON debates FOR SELECT
  USING (true);

-- Allow authenticated users to create debates
CREATE POLICY "Authenticated users can create debates"
  ON debates FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow debate creators to update their own debates
CREATE POLICY "Creators can update their own debates"
  ON debates FOR UPDATE
  USING (creator_id::text = auth.uid()::text);

-- Allow system to update debates (for status changes, participant count, etc.)
-- This is needed for the sync service
CREATE POLICY "Service role can update debates"
  ON debates FOR UPDATE
  TO service_role
  USING (true);

-- ============================================
-- 4. Participants Table Policies
-- ============================================

-- Allow anyone to read participants (needed for displaying participant lists)
CREATE POLICY "Participants are viewable by everyone"
  ON participants FOR SELECT
  USING (true);

-- Allow authenticated users to join debates (insert participant record)
CREATE POLICY "Authenticated users can join debates"
  ON participants FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Prevent users from updating participant records
-- (participants are immutable once created)

-- ============================================
-- 5. Arguments Table Policies
-- ============================================

-- Allow anyone to read arguments (public debate platform)
CREATE POLICY "Arguments are viewable by everyone"
  ON arguments FOR SELECT
  USING (true);

-- Allow authenticated users to submit arguments
CREATE POLICY "Authenticated users can submit arguments"
  ON arguments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Prevent users from updating or deleting arguments
-- (arguments are immutable once submitted)

-- ============================================
-- 6. Grant necessary permissions
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant select on all tables to anon (for public read access)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant all privileges to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant all privileges to service role (for backend operations)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ============================================
-- Notes:
-- ============================================
-- 
-- Security Model:
-- - All data is publicly readable (debates, arguments, participants)
-- - Only authenticated users can create/join debates
-- - Users can only update their own records
-- - Arguments and participants are immutable (no updates/deletes)
-- - Service role has full access for sync operations
--
-- This is appropriate for a public debate platform where:
-- - Transparency is important (all debates and arguments are public)
-- - Accountability is enforced (no editing/deleting arguments)
-- - Authentication is required to participate
--
-- Future Enhancements:
-- - Add policies for private debates (if needed)
-- - Add moderation capabilities
-- - Add user blocking/reporting

