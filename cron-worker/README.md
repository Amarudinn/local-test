# VPS Cron Worker for Ruang Debat

Script Node.js sederhana yang berjalan di VPS kamu untuk memproses evaluasi AI.

## Kenapa Pakai Ini?

- Vercel Free plan hanya 10 detik timeout
- GenLayer AI butuh 2-5 menit untuk evaluasi
- VPS tidak ada batasan timeout

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

### 3. Upload folder ini ke VPS
```bash
# Dari komputer lokal:
scp -r cron-worker user@your-vps-ip:/home/user/
```

Atau clone dari GitHub lalu masuk ke folder cron-worker.

### 4. Install dependencies
```bash
cd /home/user/cron-worker
npm install
```

### 5. Buat file .env
```bash
cp .env.example .env
nano .env
```

Isi dengan:
```
API_BASE_URL=https://local-test-three.vercel.app
CRON_SECRET=your-actual-cron-secret
```

### 6. Test jalankan
```bash
npm start
```

Kamu akan melihat log seperti:
```
{"timestamp":"...","level":"info","message":"🚀 VPS Cron Worker starting",...}
{"timestamp":"...","level":"info","message":"Starting Process Evaluation Queue",...}
```

### 7. Jalankan dengan PM2 (Production)

PM2 akan menjaga script tetap berjalan dan restart otomatis jika crash.

```bash
# Install PM2
sudo npm install -g pm2

# Start dengan PM2
pm2 start index.js --name "ruang-debat-cron"

# Auto-start saat VPS reboot
pm2 startup
pm2 save

# Lihat logs
pm2 logs ruang-debat-cron

# Restart jika perlu
pm2 restart ruang-debat-cron

# Stop
pm2 stop ruang-debat-cron
```

## Matikan Cron di cron-job.org

Setelah VPS berjalan, **matikan** cron jobs di cron-job.org agar tidak duplikat.

## Troubleshooting

### Connection refused
- Pastikan Vercel URL benar
- Cek firewall VPS (port 443 harus bisa keluar)

### Unauthorized (401)
- CRON_SECRET tidak cocok dengan yang di Vercel

### Timeout
- Normal untuk GenLayer AI (2-5 menit)
- Script sudah handle dengan timeout 5 menit
