#!/bin/bash
# iFragment Database Backup & Disaster Recovery Script
# Implements physical backups via pg_basebackup and PITR configurations

set -e

BACKUP_DIR="/var/backups/postgres"
PG_DATA="/var/lib/postgresql/data"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "=========================================="
echo "iFragment PostgreSQL Disaster Recovery Tool"
echo "=========================================="

# 1. Physical Base Backup
perform_backup() {
    echo "[+] Initializing physical database base backup..."
    mkdir -p "${BACKUP_DIR}/base_${TIMESTAMP}"
    
    # Run pg_basebackup to capture active filesystem snapshot
    pg_basebackup \
        -h "${DB_HOST:-localhost}" \
        -U "${DB_USER:-postgres}" \
        -D "${BACKUP_DIR}/base_${TIMESTAMP}" \
        -Fp -Xs -P -z
        
    echo "[+] Base backup completed successfully at ${BACKUP_DIR}/base_${TIMESTAMP}"

    # Archive the backup to a tarball
    echo "[+] Creating backup archive..."
    tar -czf "${BACKUP_DIR}/base_${TIMESTAMP}.tar.gz" -C "${BACKUP_DIR}" "base_${TIMESTAMP}"
    echo "[+] Archive created at ${BACKUP_DIR}/base_${TIMESTAMP}.tar.gz"

    # Cloud Backup: Fallback upload to AWS S3 if credentials are set (Issue 23)
    if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ] && [ -n "$S3_BUCKET_NAME" ]; then
        echo "[+] S3 Credentials detected. Uploading backup to S3..."
        if command -v aws &> /dev/null; then
            aws s3 cp "${BACKUP_DIR}/base_${TIMESTAMP}.tar.gz" "s3://${S3_BUCKET_NAME}/backups/base_${TIMESTAMP}.tar.gz"
            echo "[+] Upload to S3 completed successfully."
        else
            echo "[-] WARNING: aws CLI is not installed. Skipping S3 upload."
        fi
    else
        echo "[i] S3 backup skipped (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, or S3_BUCKET_NAME not set)."
    fi
}

# 2. PITR Setup Instructions
print_pitr_instructions() {
    echo ""
    echo "=========================================================="
    echo "POINT-IN-TIME RECOVERY (PITR) MANUAL RECOVERY INSTRUCTIONS"
    echo "=========================================================="
    echo "To restore PostgreSQL to a specific point-in-time:"
    echo "1. Stop the active PostgreSQL service:"
    echo "   $ pg_ctl -D ${PG_DATA} stop"
    echo ""
    echo "2. Move the active data directory to a safe temporary location:"
    echo "   $ mv ${PG_DATA} ${PG_DATA}_broken_${TIMESTAMP}"
    echo ""
    echo "3. Restore the base physical backup:"
    echo "   $ cp -R ${BACKUP_DIR}/base_<timestamp> ${PG_DATA}"
    echo "   $ chmod 700 ${PG_DATA}"
    echo ""
    echo "4. Create a recovery.signal file in the restored data directory:"
    echo "   $ touch ${PG_DATA}/recovery.signal"
    echo ""
    echo "5. Configure recovery settings in ${PG_DATA}/postgresql.conf or recovery.conf:"
    echo "   Add the following lines:"
    echo "     restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'"
    echo "     recovery_target_time = '2026-05-24 14:00:00 UTC'  # target timestamp"
    echo "     recovery_target_action = 'promote'                # promote to primary after recovery"
    echo ""
    echo "6. Start PostgreSQL service to run the recovery process:"
    echo "   $ pg_ctl -D ${PG_DATA} start"
    echo ""
    echo "7. Verify logs to confirm PITR completed successfully:"
    echo "   $ tail -n 100 /var/log/postgresql.log"
    echo "=========================================================="
}

case "$1" in
    backup)
        perform_backup
        ;;
    pitr)
        print_pitr_instructions
        ;;
    *)
        echo "Usage: $0 {backup|pitr}"
        exit 1
        ;;
esac
