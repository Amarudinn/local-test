-- Quick script to fix RLS policies for Privy authentication
-- Run this in your Supabase SQL Editor

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Authenticated users can create debates" ON debates;
DROP POLICY IF EXISTS "Creators can update their own debates" ON debates;
DROP POLICY IF EXISTS "Authenticated users can join debates" ON participants;
DROP POLICY IF EXISTS "Authenticated users can submit arguments" ON arguments;
DROP POLICY IF EXISTS "Users can update their own record" ON users;

-- Create new permissive policies
CREATE POLICY "Anyone can create debates"
  ON debates FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update debates"
  ON debates FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can join debates"
  ON participants FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can submit arguments"
  ON arguments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update users"
  ON users FOR UPDATE
  USING (true);
