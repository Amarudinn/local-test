# Debate Room Database Migrations

This directory contains SQL migration scripts for the Debate Room Supabase database schema.

## Overview

The database schema consists of four main tables:
- **users**: Stores user authentication data from Privy
- **debates**: Caches debate metadata from blockchain smart contracts
- **participants**: Caches participant data for each debate
- **arguments**: Caches argument submissions from participants

## Migration Files

### Forward Migrations (Create Tables)

Run these migrations in order to create the database schema:

1. **20240101000000_create_users_table.sql**
   - Creates the `users` table with Privy integration fields
   - Adds indexes on `privy_user_id` and `wallet_address`

2. **20240101000001_create_debates_table.sql**
   - Creates the `debates` table with contract metadata
   - Adds indexes on `contract_address`, `status`, `created_at`, `creator_id`, and `end_time`
   - Includes CHECK constraint for status values

3. **20240101000002_create_participants_table.sql**
   - Creates the `participants` table for caching participant data
   - Adds UNIQUE constraint on `(debate_id, wallet_address)`
   - Adds CASCADE DELETE on `debate_id` foreign key
   - Adds indexes on `debate_id`, `user_id`, and `wallet_address`

4. **20240101000003_create_arguments_table.sql**
   - Creates the `arguments` table for caching argument submissions
   - Adds CASCADE DELETE on `debate_id` foreign key
   - Adds indexes on `debate_id`, `participant_id`, and `submitted_at`

### Rollback Migration (Drop Tables)

5. **20240101000004_rollback_all_tables.sql**
   - Drops all tables and indexes in reverse order
   - Use this to completely reset the database schema

## How to Apply Migrations

### Using Supabase CLI

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link your project**:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. **Apply all migrations**:
   ```bash
   supabase db push
   ```

### Using Supabase Dashboard

1. Navigate to your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy and paste each migration file content in order
4. Execute each migration script

### Manual Application

You can also apply migrations manually using any PostgreSQL client:

```bash
psql -h YOUR_SUPABASE_HOST -U postgres -d postgres -f supabase/migrations/20240101000000_create_users_table.sql
psql -h YOUR_SUPABASE_HOST -U postgres -d postgres -f supabase/migrations/20240101000001_create_debates_table.sql
psql -h YOUR_SUPABASE_HOST -U postgres -d postgres -f supabase/migrations/20240101000002_create_participants_table.sql
psql -h YOUR_SUPABASE_HOST -U postgres -d postgres -f supabase/migrations/20240101000003_create_arguments_table.sql
```

## Database Schema Diagram

```
┌─────────────────┐
│     users       │
├─────────────────┤
│ id (PK)         │
│ privy_user_id   │◄─┐
│ wallet_address  │  │
│ email           │  │
│ created_at      │  │
└─────────────────┘  │
                     │
                     │
┌─────────────────┐  │
│    debates      │  │
├─────────────────┤  │
│ id (PK)         │  │
│ contract_address│  │
│ creator_id (FK) ├──┘
│ topic           │
│ description     │
│ duration_hours  │
│ created_at      │
│ end_time        │
│ status          │
│ participant_cnt │
│ winner_address  │
│ winner_score    │
└─────────────────┘
        ▲
        │
        │
┌───────┴─────────┐
│  participants   │
├─────────────────┤
│ id (PK)         │
│ debate_id (FK)  │
│ user_id (FK)    ├──┐
│ wallet_address  │  │
│ joined_at       │  │
│ has_submitted   │  │
└─────────────────┘  │
        ▲            │
        │            │
        │            │
┌───────┴─────────┐  │
│   arguments     │  │
├─────────────────┤  │
│ id (PK)         │  │
│ debate_id (FK)  │  │
│ participant_id  ├──┘
│ content         │
│ submitted_at    │
└─────────────────┘
```

## Key Features

### Foreign Key Relationships
- `debates.creator_id` → `users.id`
- `participants.debate_id` → `debates.id` (CASCADE DELETE)
- `participants.user_id` → `users.id` (nullable)
- `arguments.debate_id` → `debates.id` (CASCADE DELETE)
- `arguments.participant_id` → `participants.id`

### Unique Constraints
- `users.privy_user_id` - Each Privy user can only have one account
- `debates.contract_address` - Each contract address is unique
- `participants.(debate_id, wallet_address)` - Each wallet can only join a debate once

### Check Constraints
- `debates.status` - Must be one of: 'OPEN', 'ONGOING', 'ENDED', 'RESOLVED'

### Indexes
Performance indexes are created on:
- All foreign key columns
- Frequently queried columns (status, created_at, contract_address)
- Columns used for sorting (created_at DESC, submitted_at)

### Cascade Deletes
When a debate is deleted:
- All associated participants are automatically deleted
- All associated arguments are automatically deleted

## Rollback Instructions

To rollback all migrations and drop all tables:

```bash
# Using Supabase CLI
supabase db reset

# Or manually execute the rollback script
psql -h YOUR_SUPABASE_HOST -U postgres -d postgres -f supabase/migrations/20240101000004_rollback_all_tables.sql
```

**Warning**: This will permanently delete all data in these tables!

## Environment Variables

Make sure your `.env.local` file contains the correct Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Testing Migrations

After applying migrations, verify the schema:

```sql
-- List all tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check table structure
\d users
\d debates
\d participants
\d arguments

-- Verify indexes
SELECT tablename, indexname FROM pg_indexes 
WHERE schemaname = 'public';

-- Verify foreign keys
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

## Troubleshooting

### Migration Already Applied
If you see "relation already exists" errors, the migration has already been applied. You can safely ignore these errors or run the rollback script first.

### Permission Denied
Make sure you're using the correct database credentials with sufficient permissions. The service role key has full access.

### Foreign Key Violations
If you encounter foreign key violations, ensure you're applying migrations in the correct order (users → debates → participants → arguments).

## Next Steps

After applying migrations:
1. Verify the schema in Supabase Dashboard
2. Test database operations using the Supabase client
3. Implement the sync service to populate these tables from blockchain data
4. Set up Row Level Security (RLS) policies if needed

## Support

For issues or questions:
- Check the Supabase documentation: https://supabase.com/docs
- Review the design document: `.kiro/specs/ruang-debat/design.md`
- Check the requirements: `.kiro/specs/ruang-debat/requirements.md`
