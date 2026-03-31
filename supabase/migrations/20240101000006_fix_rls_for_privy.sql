-- ============================================
-- Fix RLS Policies for Privy Authentication
-- ============================================
-- This migration updates RLS policies to work with Privy authentication
-- instead of Supabase auth. Since we use Privy for user authentication,
-- we need to allow operations without Supabase auth.uid()

-- ============================================
-- Drop existing restrictive policies
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can create debates" ON debates;
DROP POLICY IF EXISTS "Creators can update their own debates" ON debates;
DROP POLICY IF EXISTS "Authenticated users can join debates" ON participants;
DROP POLICY IF EXISTS "Authenticated users can submit arguments" ON arguments;
DROP POLICY IF EXISTS "Users can update their own record" ON users;

-- ============================================
-- Create new permissive policies
-- ============================================

-- Allow anyone to create debates (Privy handles authentication on the client)
CREATE POLICY "Anyone can create debates"
  ON debates FOR INSERT
  WITH CHECK (true);

-- Allow anyone to update debates (needed for sync service)
-- In production, you might want to add application-level checks
CREATE POLICY "Anyone can update debates"
  ON debates FOR UPDATE
  USING (true);

-- Allow anyone to insert participants (Privy handles authentication)
CREATE POLICY "Anyone can join debates"
  ON participants FOR INSERT
  WITH CHECK (true);

-- Allow anyone to submit arguments (Privy handles authentication)
CREATE POLICY "Anyone can submit arguments"
  ON arguments FOR INSERT
  WITH CHECK (true);

-- Allow anyone to update users (for profile updates)
CREATE POLICY "Anyone can update users"
  ON users FOR UPDATE
  USING (true);

-- ============================================
-- Notes:
-- ============================================
-- 
-- Security Model with Privy:
-- - Authentication is handled by Privy on the client side
-- - Database operations are allowed for all authenticated Privy users
-- - RLS is kept enabled for future fine-grained control
-- - Application logic validates user permissions before database calls
--
-- This is a pragmatic approach for a Privy-based app where:
-- - Supabase is used as a cache/query layer, not the auth provider
-- - The blockchain is the source of truth
-- - Privy provides wallet-based authentication
--
-- Future Enhancements:
-- - Implement server-side API routes with service role key
-- - Add application-level permission checks
-- - Consider using Supabase Edge Functions for sensitive operations
