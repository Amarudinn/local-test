# VPS Direct Processor for Debate Room

Script Node.js yang berjalan di VPS dan memproses evaluasi AI **langsung** tanpa melalui Vercel.

## Kenapa Pakai Ini?

```
❌ Lama: VPS → Vercel API → [10s timeout] → Gagal
✅ Baru: VPS → Supabase + GenLayer langsung → Sukses!
```

## Setup di VPS

### 1. SSH ke VPS
```bash
ssh user@your-vps-ip
```

### 2. Install Node.js (jika belum ada)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3. Clone/Update repo
```bash
# Clone baru
git clone https://github.com/Amarudinn/local-test.git
cd local-test/cron-worker

# Atau update yang sudah ada
cd local-test && git pull && cd cron-worker
```

### 4. Install dependencies
```bash
npm install
```

### 5. Buat file .env
```bash
cp .env.example .env
nano .env
```

Isi dengan nilai dari Supabase dan GenLayer:
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...
GENLAYER_RPC_URL=https://studio.genlayer.com/api
GENLAYER_PRIVATE_KEY=0x...
```

### 6. Test jalankan
```bash
npm start
```

### 7. Jalankan dengan PM2 (Production)
```bash
sudo npm install -g pm2
pm2 start index.js --name "ruang-debat"
pm2 startup && pm2 save
pm2 logs ruang-debat
```

## Matikan cron-job.org

Karena VPS memproses langsung, **matikan** semua cron jobs di cron-job.org.

## Troubleshooting

| Error | Solusi |
|-------|--------|
| Missing SUPABASE_URL | Isi .env dengan benar |
| GenLayer timeout | Normal, AI butuh 2-5 menit |
| Cannot find module | Jalankan `npm install` |
