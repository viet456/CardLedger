# CardLedger VPS Deployment & Backup

## Architecture

```
┌─────────────────────────────────────────┐
│  VPS (Docker Compose)                   │
│                                         │
│  ┌──────────┐   ┌──────────────────┐   │
│  │ Postgres  │◄──│  Sync Server     │   │
│  │ :5432     │   │  (SSE, :8080)    │   │
│  └──────────┘   └──────────────────┘   │
│       ▲              ▲                  │
│       │              │                  │
│  ┌──────────┐   ┌──────────────────┐   │
│  │  Backup   │   │  Nginx           │   │
│  │  (cron)   │   │  :80 / :443      │   │
│  └──────────┘   └──────────────────┘   │
│       │                                 │
│       ▼                                 │
│   Cloudflare R2 (offsite backups)       │
└─────────────────────────────────────────┘
```

## Prerequisites

- A VPS (Ubuntu 22.04+ / Debian 12+ recommended)
- Docker & Docker Compose installed
- A Cloudflare R2 bucket for backups
- DNS A record pointing `sync.cardledger.io` to your VPS IP

---

## First-Time Setup

### 1. Install Docker on the VPS

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Log out and back in for group to take effect
exit
ssh root@your-vps-ip

# Verify
docker --version
docker compose version
```

### 2. Clone the repo

```bash
cd ~
git clone https://github.com/viet456/CardLedger.git
cd CardLedger
```

### 3. Create `.env`

```bash
cp .env.example .env
nano .env
```

Fill in all values. Key ones for Docker/backup:

| Variable | Example |
|----------|---------|
| `POSTGRES_USER` | `cardledger` |
| `POSTGRES_PASSWORD` | Generate with `openssl rand -base64 32` |
| `POSTGRES_DB` | `cardledger` |
| `R2_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` |
| `R2_BACKUP_BUCKET` | `cardledger-backups` |
| `R2_ACCESS_KEY_ID` | Your R2 API token key |
| `R2_SECRET_ACCESS_KEY` | Your R2 API token secret |

### 4. Migrate existing Postgres data into Docker

If you already have data in a native Postgres on the VPS:

```bash
# Dump from the native Postgres (runs on host port 5432)
pg_dump -U cardledger -h 127.0.0.1 -p 5432 --format=custom cardledger > /tmp/cardledger-migration.dump

# Start just the Postgres container
docker compose up -d postgres
sleep 10

# Restore into the Docker volume
docker compose exec -T postgres pg_restore \
  -U cardledger -d cardledger --clean --if-exists \
  < /tmp/cardledger-migration.dump

# Verify data
docker compose exec - postgres psql -U cardledger -d cardledger -c "\dt"
```

### 5. Stop native services

```bash
# Stop native Postgres
sudo systemctl stop postgresql
sudo systemctl disable postgresql

# Stop PM2-managed sync server
pm2 delete sync-tower
pm2 save
```

### 6. Start everything

```bash
docker compose up -d
docker compose logs -f  # watch all services start up
```

### 7. Set up SSL (Certbot on host)

```bash
sudo apt install nginx certbot python3-certbot-nginx -y

# Create a temporary nginx config for certbot HTTP-01 challenge
sudo tee /etc/nginx/sites-available/sync.cardledger.io <<'EOF'
server {
    listen 80;
    server_name sync.cardledger.io;
    location / {
        proxy_pass http://127.0.0.1:80;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/sync.cardledger.io /etc/nginx/sites-enabled/
sudo systemctl restart nginx

# Get certificate
sudo certbot --nginx -d sync.cardledger.io

# Stop native nginx — Docker nginx will handle traffic
sudo systemctl stop nginx
sudo systemctl disable nginx

# Re-run certbot renewal manually to test, or set up a cron:
# sudo certbot renew --dry-run
```

> **Note:** For SSL termination, you have two options:
> 1. Mount certs into the Docker nginx container (recommended for production)
> 2. Keep native nginx as SSL terminator, proxy to Docker nginx on a local port
>
> Option 1 is cleaner. Add a volume mount to `docker-compose.yml` nginx service:
> ```yaml
> volumes:
>   - /etc/letsencrypt:/etc/letsencrypt:ro
> ```
> And update `docker.conf` to include SSL listeners and cert paths.

---

## Daily Operations

### View logs

```bash
docker compose logs -f                  # all services
docker compose logs -f sync-server      # just SSE server
docker compose logs -f backup           # just backups
docker compose logs -f postgres         # just database
```

### Restart a single service

```bash
docker compose restart sync-server
```

### Update after code changes

```bash
cd ~/CardLedger
git pull
docker compose up -d --build
```

### Manual backup trigger

```bash
docker compose exec backup /backup.sh
```

### List backups on R2

```bash
aws s3 ls s3://your-backup-bucket/db-backups/ \
  --endpoint-url https://<account_id>.r2.cloudflarestorage.com
```

---

## Disaster Recovery

### Scenario: VPS is completely gone

1. **Spin up a new VPS** (any provider, any size)

2. **Install Docker**
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   # re-login
   ```

3. **Clone and configure**
   ```bash
   cd ~
   git clone https://github.com/viet456/CardLedger.git
   cd CardLedger
   cp .env.example .env
   nano .env   # fill in secrets (use password manager!)
   ```

4. **Start Postgres only**
   ```bash
   docker compose up -d postgres
   sleep 10
   ```

5. **Download latest backup from R2**
   ```bash
   aws s3 cp s3://your-backup-bucket/db-backups/latest.dump /tmp/latest.dump \
     --endpoint-url https://<account_id>.r2.cloudflarestorage.com
   ```

6. **Restore database**
   ```bash
   docker compose exec -T postgres pg_restore \
     -U cardledger -d cardledger --clean --if-exists \
     < /tmp/latest.dump
   ```

7. **Start everything**
   ```bash
   docker compose up -d
   ```

8. **Point DNS** to the new VPS IP

9. **Set up SSL** (see SSL section above)

**Total recovery time: ~15 minutes.**

### Scenario: Database corruption (not server death)

Restore from a specific timestamped backup:

```bash
# List available backups
aws s3 ls s3://your-backup-bucket/db-backups/ \
  --endpoint-url https://<account_id>.r2.cloudflarestorage.com

# Download a specific backup
aws s3 cp s3://your-backup-bucket/db-backups/cardledger_20260719_030000.dump /tmp/ \
  --endpoint-url https://<account_id>.r2.cloudflarestorage.com

# Stop the sync server (prevent writes during restore)
docker compose stop sync-server

# Restore
docker compose exec -T postgres pg_restore \
  -U cardledger -d cardledger --clean --if-exists \
  < /tmp/cardledger_20260719_030000.dump

# Restart
docker compose up -d
```

---

## Backup Details

| Property | Value |
|----------|-------|
| **Method** | `pg_dump --format=custom --compress=6` |
| **Schedule** | Daily at 03:00 UTC |
| **First backup** | Runs immediately on container start |
| **Storage** | Local (`./backups/`) + Cloudflare R2 |
| **Retention** | 30 days (configurable via `BACKUP_RETENTION_DAYS`) |
| **Compression** | ~60-70% size reduction (500MB DB → ~150-200MB) |
| **R2 key pattern** | `db-backups/cardledger_YYYYMMDD_HHMMSS.dump` |
| **Easy restore** | `db-backups/latest.dump` always points to newest |

---

## File Reference

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Orchestrates all services |
| `sync-server/Dockerfile` | Node.js SSE server image |
| `sync-server/server.js` | SSE server code (LISTEN/NOTIFY) |
| `sync-server/nginx/docker.conf` | Nginx config (Docker networking) |
| `sync-server/nginx/sync.cardledger.io.conf` | Nginx config (native/host — legacy) |
| `backup/Dockerfile` | Backup service image (Alpine + pg_dump + aws-cli) |
| `backup/backup.sh` | Backup script (dump → compress → R2 → rotate) |
| `.env.example` | Template for environment variables |
| `backups/` | Local backup storage (gitignored) |