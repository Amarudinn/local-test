-- Rollback migration: Drop all tables in reverse order
-- This script removes all tables created by the forward migrations
-- Run this script to completely reset the database schema

-- Drop tables in reverse order of creation (respecting foreign key dependencies)
DROP TABLE IF EXISTS arguments CASCADE;
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS debates CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop indexes (if they weren't dropped with CASCADE)
DROP INDEX IF EXISTS idx_arguments_submitted_at;
DROP INDEX IF EXISTS idx_arguments_participant_id;
DROP INDEX IF EXISTS idx_arguments_debate_id;
DROP INDEX IF EXISTS idx_participants_wallet_address;
DROP INDEX IF EXISTS idx_participants_user_id;
DROP INDEX IF EXISTS idx_participants_debate_id;
DROP INDEX IF EXISTS idx_debates_end_time;
DROP INDEX IF EXISTS idx_debates_creator_id;
DROP INDEX IF EXISTS idx_debates_created_at;
DROP INDEX IF EXISTS idx_debates_status;
DROP INDEX IF EXISTS idx_debates_contract_address;
DROP INDEX IF EXISTS idx_users_wallet_address;
DROP INDEX IF EXISTS idx_users_privy_user_id;
