-- Schema Verification Script
-- Run this script after applying migrations to verify the database schema

-- ============================================================================
-- 1. Verify all tables exist
-- ============================================================================

SELECT 
  'Tables Check' as check_type,
  CASE 
    WHEN COUNT(*) = 4 THEN '✓ PASS: All 4 tables exist'
    ELSE '✗ FAIL: Expected 4 tables, found ' || COUNT(*)
  END as result
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'debates', 'participants', 'arguments');

-- ============================================================================
-- 2. Verify table columns
-- ============================================================================

-- Users table columns
SELECT 
  'Users Columns' as check_type,
  CASE 
    WHEN COUNT(*) = 5 THEN '✓ PASS: Users table has 5 columns'
    ELSE '✗ FAIL: Users table has ' || COUNT(*) || ' columns (expected 5)'
  END as result
FROM information_schema.columns 
WHERE table_name = 'users';

-- Debates table columns
SELECT 
  'Debates Columns' as check_type,
  CASE 
    WHEN COUNT(*) = 12 THEN '✓ PASS: Debates table has 12 columns'
    ELSE '✗ FAIL: Debates table has ' || COUNT(*) || ' columns (expected 12)'
  END as result
FROM information_schema.columns 
WHERE table_name = 'debates';

-- Participants table columns
SELECT 
  'Participants Columns' as check_type,
  CASE 
    WHEN COUNT(*) = 6 THEN '✓ PASS: Participants table has 6 columns'
    ELSE '✗ FAIL: Participants table has ' || COUNT(*) || ' columns (expected 6)'
  END as result
FROM information_schema.columns 
WHERE table_name = 'participants';

-- Arguments table columns
SELECT 
  'Arguments Columns' as check_type,
  CASE 
    WHEN COUNT(*) = 5 THEN '✓ PASS: Arguments table has 5 columns'
    ELSE '✗ FAIL: Arguments table has ' || COUNT(*) || ' columns (expected 5)'
  END as result
FROM information_schema.columns 
WHERE table_name = 'arguments';

-- ============================================================================
-- 3. Verify indexes
-- ============================================================================

SELECT 
  'Indexes Check' as check_type,
  CASE 
    WHEN COUNT(*) >= 13 THEN '✓ PASS: Found ' || COUNT(*) || ' indexes'
    ELSE '✗ FAIL: Found only ' || COUNT(*) || ' indexes (expected at least 13)'
  END as result
FROM pg_indexes 
WHERE schemaname = 'public'
  AND tablename IN ('users', 'debates', 'participants', 'arguments');

-- ============================================================================
-- 4. Verify foreign keys
-- ============================================================================

SELECT 
  'Foreign Keys Check' as check_type,
  CASE 
    WHEN COUNT(*) = 5 THEN '✓ PASS: All 5 foreign keys exist'
    ELSE '✗ FAIL: Found ' || COUNT(*) || ' foreign keys (expected 5)'
  END as result
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY'
  AND table_name IN ('debates', 'participants', 'arguments');

-- ============================================================================
-- 5. Verify unique constraints
-- ============================================================================

SELECT 
  'Unique Constraints' as check_type,
  CASE 
    WHEN COUNT(*) >= 3 THEN '✓ PASS: Found ' || COUNT(*) || ' unique constraints'
    ELSE '✗ FAIL: Found only ' || COUNT(*) || ' unique constraints (expected at least 3)'
  END as result
FROM information_schema.table_constraints 
WHERE constraint_type = 'UNIQUE'
  AND table_name IN ('users', 'debates', 'participants');

-- ============================================================================
-- 6. Verify check constraints
-- ============================================================================

SELECT 
  'Check Constraints' as check_type,
  CASE 
    WHEN COUNT(*) >= 1 THEN '✓ PASS: Found ' || COUNT(*) || ' check constraint(s)'
    ELSE '✗ FAIL: No check constraints found (expected at least 1)'
  END as result
FROM information_schema.table_constraints 
WHERE constraint_type = 'CHECK'
  AND table_name = 'debates';

-- ============================================================================
-- 7. Detailed table information
-- ============================================================================

-- List all tables with column counts
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = t.table_name) as indexes
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'debates', 'participants', 'arguments')
ORDER BY 
  CASE table_name
    WHEN 'users' THEN 1
    WHEN 'debates' THEN 2
    WHEN 'participants' THEN 3
    WHEN 'arguments' THEN 4
  END;

-- ============================================================================
-- 8. List all foreign key relationships
-- ============================================================================

SELECT
    tc.table_name AS from_table, 
    kcu.column_name AS from_column, 
    ccu.table_name AS to_table,
    ccu.column_name AS to_column,
    rc.delete_rule AS on_delete
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('debates', 'participants', 'arguments')
ORDER BY tc.table_name;

-- ============================================================================
-- 9. List all indexes
-- ============================================================================

SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
  AND tablename IN ('users', 'debates', 'participants', 'arguments')
ORDER BY tablename, indexname;

-- ============================================================================
-- 10. Test basic operations (optional - will create test data)
-- ============================================================================

-- Uncomment the following to test basic CRUD operations:

/*
-- Insert test user
INSERT INTO users (privy_user_id, wallet_address, email) 
VALUES ('test_privy_123', '0x1234567890123456789012345678901234567890', 'test@example.com')
RETURNING id, privy_user_id;

-- Insert test debate
INSERT INTO debates (
  contract_address, 
  creator_id, 
  topic, 
  description, 
  duration_hours, 
  end_time, 
  status
) 
VALUES (
  '0xabcdef1234567890abcdef1234567890abcdef12',
  (SELECT id FROM users WHERE privy_user_id = 'test_privy_123'),
  'Test Debate Topic',
  'This is a test debate description',
  24,
  NOW() + INTERVAL '24 hours',
  'OPEN'
)
RETURNING id, contract_address, topic;

-- Clean up test data
DELETE FROM debates WHERE contract_address = '0xabcdef1234567890abcdef1234567890abcdef12';
DELETE FROM users WHERE privy_user_id = 'test_privy_123';
*/

-- ============================================================================
-- Verification Complete
-- ============================================================================

SELECT '✓ Schema verification complete!' as status;
