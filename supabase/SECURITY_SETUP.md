# Security Setup - Row Level Security (RLS)

## ⚠️ Warning: "Unrestricted" Tables

Jika Anda melihat warning "unrestricted" di Supabase dashboard, itu berarti Row Level Security (RLS) belum diaktifkan. Ini adalah security risk karena siapa saja bisa mengakses dan memodifikasi data.

## 🔒 Mengaktifkan Row Level Security

### Cara 1: Via Supabase Dashboard (Recommended)

1. **Buka Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Pilih project Anda

2. **Buka SQL Editor**
   - Klik **SQL Editor** di sidebar kiri
   - Klik **New query**

3. **Run RLS Migration**
   - Copy seluruh isi file: `migrations/20240101000005_enable_rls_policies.sql`
   - Paste ke SQL Editor
   - Klik **Run** atau tekan `Ctrl+Enter`
   - Tunggu sampai selesai (akan muncul "Success")

4. **Verify RLS Enabled**
   - Klik **Table Editor** di sidebar
   - Pilih salah satu table (users, debates, participants, arguments)
   - Klik **RLS** tab
   - Anda akan melihat policies yang sudah dibuat
   - Warning "unrestricted" seharusnya hilang

### Cara 2: Via Supabase CLI

```bash
# Jika Anda menggunakan Supabase CLI
supabase db push
```

## 🛡️ Security Policies yang Diterapkan

### Users Table
- ✅ **Read**: Semua orang bisa melihat user profiles (untuk display creator info)
- ✅ **Insert**: Semua orang bisa membuat user record (saat registrasi)
- ✅ **Update**: User hanya bisa update record mereka sendiri
- ❌ **Delete**: Tidak diizinkan

### Debates Table
- ✅ **Read**: Semua orang bisa melihat semua debates (public platform)
- ✅ **Insert**: Hanya authenticated users bisa membuat debates
- ✅ **Update**: Creator bisa update debate mereka sendiri
- ✅ **Update (Service)**: Service role bisa update untuk sync operations
- ❌ **Delete**: Tidak diizinkan

### Participants Table
- ✅ **Read**: Semua orang bisa melihat participants (public)
- ✅ **Insert**: Hanya authenticated users bisa join debates
- ❌ **Update**: Tidak diizinkan (immutable)
- ❌ **Delete**: Tidak diizinkan

### Arguments Table
- ✅ **Read**: Semua orang bisa melihat arguments (public)
- ✅ **Insert**: Hanya authenticated users bisa submit arguments
- ❌ **Update**: Tidak diizinkan (immutable - no editing arguments)
- ❌ **Delete**: Tidak diizinkan (immutable - no deleting arguments)

## 🎯 Security Model

Platform ini menggunakan **Public Transparency Model**:

1. **Public Read Access**
   - Semua debates, arguments, dan participants bisa dilihat siapa saja
   - Ini penting untuk transparansi dan accountability
   - Tidak perlu login untuk melihat debates

2. **Authenticated Write Access**
   - Harus login untuk membuat debate atau submit argument
   - Ini mencegah spam dan abuse

3. **Immutable Arguments**
   - Arguments tidak bisa diedit atau dihapus setelah disubmit
   - Ini menjaga integritas debate
   - Mencegah manipulation setelah AI judging

4. **Service Role Access**
   - Backend sync service punya full access
   - Digunakan untuk update status, participant count, dll
   - Menggunakan service role key (bukan anon key)

## 🔍 Testing RLS Policies

### Test 1: Public Read Access
```sql
-- Run di SQL Editor sebagai anon user
SELECT * FROM debates;
-- Should work: Returns all debates
```

### Test 2: Authenticated Insert
```sql
-- Run di SQL Editor sebagai authenticated user
INSERT INTO debates (contract_address, creator_id, topic, description, duration_hours, end_time, status)
VALUES ('0x123...', 'user-uuid', 'Test', 'Test debate', 24, NOW() + INTERVAL '24 hours', 'OPEN');
-- Should work if authenticated
```

### Test 3: Unauthorized Update
```sql
-- Try to update someone else's debate
UPDATE debates SET topic = 'Hacked' WHERE creator_id != auth.uid();
-- Should fail: No rows updated
```

## 🚨 Troubleshooting

### "new row violates row-level security policy"

**Penyebab**: User tidak punya permission untuk operasi tersebut

**Solusi**:
1. Pastikan user sudah authenticated
2. Check policy yang sesuai sudah dibuat
3. Verify auth.uid() matches dengan user_id/creator_id

### "permission denied for table"

**Penyebab**: GRANT permissions belum diterapkan

**Solusi**:
1. Run migration lagi
2. Check GRANT statements di migration file
3. Verify role (anon, authenticated, service_role)

### Policies tidak muncul di dashboard

**Penyebab**: Migration belum dijalankan atau gagal

**Solusi**:
1. Check SQL Editor history untuk errors
2. Run migration lagi
3. Refresh dashboard

## 📝 Best Practices

1. **Always Enable RLS**
   - Jangan pernah disable RLS di production
   - Gunakan policies untuk control access

2. **Test Policies**
   - Test sebagai anon user
   - Test sebagai authenticated user
   - Test sebagai different users

3. **Audit Logs**
   - Monitor Supabase logs untuk unauthorized access attempts
   - Review policies secara berkala

4. **Service Role Key**
   - Jangan expose service role key di frontend
   - Hanya gunakan di backend/server-side
   - Store di environment variables yang aman

## 🔄 Rollback (Jika Diperlukan)

Jika ada masalah dengan policies:

```sql
-- Disable RLS (TEMPORARY - for debugging only)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE debates DISABLE ROW LEVEL SECURITY;
ALTER TABLE participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE arguments DISABLE ROW LEVEL SECURITY;

-- Drop all policies
DROP POLICY IF EXISTS "Users are viewable by everyone" ON users;
DROP POLICY IF EXISTS "Users can insert their own record" ON users;
-- ... (drop semua policies)

-- Re-enable RLS dan buat policies baru
-- Run migration lagi
```

## ✅ Verification Checklist

Setelah menerapkan RLS:

- [ ] RLS enabled untuk semua tables (users, debates, participants, arguments)
- [ ] Warning "unrestricted" hilang dari Supabase dashboard
- [ ] Bisa melihat policies di RLS tab untuk setiap table
- [ ] Frontend masih bisa read data (public access)
- [ ] Frontend bisa create debates setelah login
- [ ] Frontend bisa submit arguments setelah login
- [ ] Tidak bisa update/delete arguments (immutable)

## 📚 Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers)

