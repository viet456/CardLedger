#!/bin/bash
set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────
BACKUP_DIR="/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
R2_BUCKET="${R2_BACKUP_BUCKET}"
R2_PREFIX="db-backups"

# ─── Functions ────────────────────────────────────────────────────────

run_backup() {
    local TIMESTAMP
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    local BACKUP_FILE="${BACKUP_DIR}/cardledger_${TIMESTAMP}.dump"

    mkdir -p "$BACKUP_DIR"

    echo "[$(date)] Starting backup..."

    # Dump with built-in compression (custom format, compression level 6)
    pg_dump \
        --format=custom \
        --compress=6 \
        --host="$PGHOST" \
        --username="$PGUSER" \
        --dbname="$PGDATABASE" \
        --file="$BACKUP_FILE"

    local BACKUP_SIZE
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] Backup complete: $BACKUP_FILE ($BACKUP_SIZE)"

    # Upload to R2
    if [ -n "$R2_BUCKET" ] && [ -n "${AWS_ACCESS_KEY_ID:-}" ]; then
        local R2_KEY="${R2_PREFIX}/$(basename "$BACKUP_FILE")"
        echo "[$(date)] Uploading to R2: s3://${R2_BUCKET}/${R2_KEY}..."

        aws s3 cp "$BACKUP_FILE" "s3://${R2_BUCKET}/${R2_KEY}" \
            --endpoint-url "$R2_ENDPOINT" \
            --region auto \
            --quiet

        echo "[$(date)] Upload complete."

        # Also upload as "latest" for easy restore
        aws s3 cp "$BACKUP_FILE" "s3://${R2_BUCKET}/${R2_PREFIX}/latest.dump" \
            --endpoint-url "$R2_ENDPOINT" \
            --region auto \
            --quiet
    else
        echo "[$(date)] R2 not configured — backup stored locally only."
    fi

    # Cleanup local backups older than retention period
    echo "[$(date)] Cleaning up local backups older than ${RETENTION_DAYS} days..."
    find "$BACKUP_DIR" -name "cardledger_*.dump" -mtime +"${RETENTION_DAYS}" -delete 2>/dev/null || true

    # Cleanup old backups on R2 (keep last 5 most recent, delete the rest)
    if [ -n "$R2_BUCKET" ] && [ -n "${AWS_ACCESS_KEY_ID:-}" ]; then
        echo "[$(date)] Cleaning up old R2 backups (keeping last 5)..."
        aws s3 ls "s3://${R2_BUCKET}/${R2_PREFIX}/" \
            --endpoint-url "$R2_ENDPOINT" 2>/dev/null \
            | grep "cardledger_" \
            | awk '{print $4}' \
            | sort -r \
            | tail -n +6 \
            | while read -r file_name; do
                if [ -n "$file_name" ]; then
                    aws s3 rm "s3://${R2_BUCKET}/${R2_PREFIX}/${file_name}" \
                        --endpoint-url "$R2_ENDPOINT" \
                        --quiet
                    echo "[$(date)] Deleted old R2 backup: $file_name"
                fi
            done
    fi

    echo "[$(date)] Backup job complete."
}

# ─── Main Loop ────────────────────────────────────────────────────────

# Run an initial backup immediately on container start
run_backup

# Then loop every 24 hours
INTERVAL=$((24 * 60 * 60))  # 86400 seconds = 24 hours

while true; do
    echo "[$(date)] Next backup in ${INTERVAL}s (24 hours)..."
    sleep "$INTERVAL"
    run_backup
done
