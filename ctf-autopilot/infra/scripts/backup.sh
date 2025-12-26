#!/bin/bash
#===============================================================================
# CTF Compass - PostgreSQL Backup Script
# Automatic backup with 7-day rotation
#===============================================================================

# Use -eo instead of -euo to handle potential unbound variables
set -eo pipefail

# Configuration
INSTALL_DIR="${INSTALL_DIR:-/opt/ctf-compass}"
BACKUP_DIR="${BACKUP_DIR:-/opt/ctf-compass/backups}"
CONTAINER_NAME="ctf_compass_postgres"
DB_NAME="ctf_compass"
DB_USER="postgres"
RETENTION_DAYS=7
DATE_FORMAT=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="ctf_compass_${DATE_FORMAT}.sql.gz"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC} $1"; }

#===============================================================================
# Functions
#===============================================================================

show_help() {
    echo ""
    echo "CTF Compass - PostgreSQL Backup Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --backup      Create a new backup (default)"
    echo "  --restore     Restore from latest backup"
    echo "  --restore-file FILE  Restore from specific backup file"
    echo "  --list        List available backups"
    echo "  --cleanup     Remove old backups (keep last $RETENTION_DAYS days)"
    echo "  --setup-cron  Setup automatic daily backup cron job"
    echo "  --help        Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  BACKUP_DIR       Backup directory (default: /opt/ctf-compass/backups)"
    echo "  RETENTION_DAYS   Days to keep backups (default: 7)"
    echo ""
}

check_container() {
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_error "PostgreSQL container '$CONTAINER_NAME' is not running!"
        exit 1
    fi
}

create_backup_dir() {
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log_step "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
        chmod 700 "$BACKUP_DIR"
    fi
}

do_backup() {
    log_info "Starting PostgreSQL backup..."
    check_container
    create_backup_dir

    local backup_path="${BACKUP_DIR}/${BACKUP_FILE}"
    
    log_step "Creating backup: $BACKUP_FILE"
    
    # Create backup using pg_dump
    docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$backup_path"
    
    # Verify backup
    if [[ -f "$backup_path" ]] && [[ $(stat -f%z "$backup_path" 2>/dev/null || stat -c%s "$backup_path" 2>/dev/null) -gt 0 ]]; then
        local size=$(du -h "$backup_path" | cut -f1)
        log_info "✅ Backup created successfully: $backup_path ($size)"
        
        # Cleanup old backups
        cleanup_old_backups
    else
        log_error "Backup failed or file is empty!"
        rm -f "$backup_path"
        exit 1
    fi
}

do_restore() {
    local restore_file="$1"
    
    if [[ -z "$restore_file" ]]; then
        # Find latest backup
        restore_file=$(ls -t "${BACKUP_DIR}"/ctf_compass_*.sql.gz 2>/dev/null | head -1)
        if [[ -z "$restore_file" ]]; then
            log_error "No backup files found in $BACKUP_DIR"
            exit 1
        fi
    fi

    if [[ ! -f "$restore_file" ]]; then
        log_error "Backup file not found: $restore_file"
        exit 1
    fi

    log_warn "⚠️  This will OVERWRITE the current database!"
    read -p "Are you sure you want to restore from $(basename "$restore_file")? [y/N] " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        log_info "Restore cancelled."
        exit 0
    fi

    check_container

    log_step "Restoring from: $(basename "$restore_file")"
    
    # Drop and recreate database
    docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS ${DB_NAME};" postgres
    docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "CREATE DATABASE ${DB_NAME};" postgres
    
    # Restore backup
    gunzip -c "$restore_file" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" "$DB_NAME"
    
    log_info "✅ Database restored successfully!"
    log_warn "You may need to restart the API service: docker restart ctf_compass_api"
}

list_backups() {
    log_info "Available backups in $BACKUP_DIR:"
    echo ""
    
    if [[ -d "$BACKUP_DIR" ]]; then
        local count=0
        while IFS= read -r file; do
            if [[ -n "$file" ]]; then
                local size=$(du -h "$file" | cut -f1)
                local date=$(basename "$file" | sed 's/ctf_compass_\([0-9]*\)_\([0-9]*\).*/\1 \2/' | sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\) \([0-9]\{2\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3 \4:\5:\6/')
                echo "  📁 $(basename "$file") ($size) - $date"
                ((count++))
            fi
        done < <(ls -t "${BACKUP_DIR}"/ctf_compass_*.sql.gz 2>/dev/null)
        
        if [[ $count -eq 0 ]]; then
            echo "  No backups found."
        else
            echo ""
            echo "Total: $count backup(s)"
        fi
    else
        echo "  Backup directory does not exist."
    fi
    echo ""
}

cleanup_old_backups() {
    log_step "Cleaning up backups older than $RETENTION_DAYS days..."
    
    local deleted=0
    while IFS= read -r file; do
        if [[ -n "$file" ]]; then
            rm -f "$file"
            log_info "Deleted old backup: $(basename "$file")"
            ((deleted++))
        fi
    done < <(find "$BACKUP_DIR" -name "ctf_compass_*.sql.gz" -type f -mtime +$RETENTION_DAYS 2>/dev/null)
    
    if [[ $deleted -eq 0 ]]; then
        log_info "No old backups to delete."
    else
        log_info "Deleted $deleted old backup(s)."
    fi
}

setup_cron() {
    log_info "Setting up automatic daily backup cron job..."
    
    local cron_script="/etc/cron.daily/ctf-compass-backup"
    local backup_script="${INSTALL_DIR}/ctf-autopilot/infra/scripts/backup.sh"
    
    # Create cron script
    cat > "$cron_script" << EOF
#!/bin/bash
# CTF Compass - Daily Backup
# Auto-generated by backup.sh

export BACKUP_DIR="${BACKUP_DIR}"
export RETENTION_DAYS=${RETENTION_DAYS}

# Run backup
${backup_script} --backup >> /var/log/ctf-compass-backup.log 2>&1
EOF

    chmod +x "$cron_script"
    
    log_info "✅ Cron job created: $cron_script"
    log_info "   Backups will run daily and keep last $RETENTION_DAYS days"
    log_info "   Logs: /var/log/ctf-compass-backup.log"
    
    # Also add to crontab for more precise timing (2 AM daily)
    local cron_entry="0 2 * * * ${backup_script} --backup >> /var/log/ctf-compass-backup.log 2>&1"
    
    # Check if already exists
    if ! crontab -l 2>/dev/null | grep -q "ctf-compass.*backup"; then
        (crontab -l 2>/dev/null; echo "$cron_entry") | crontab -
        log_info "✅ Added crontab entry for 2 AM daily backup"
    else
        log_warn "Crontab entry already exists"
    fi
}

#===============================================================================
# Main
#===============================================================================

main() {
    case "${1:-}" in
        --restore)
            do_restore ""
            ;;
        --restore-file)
            if [[ -z "${2:-}" ]]; then
                log_error "Please specify a backup file"
                exit 1
            fi
            do_restore "$2"
            ;;
        --list)
            list_backups
            ;;
        --cleanup)
            cleanup_old_backups
            ;;
        --setup-cron)
            setup_cron
            ;;
        --help|-h)
            show_help
            ;;
        --backup|"")
            do_backup
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
