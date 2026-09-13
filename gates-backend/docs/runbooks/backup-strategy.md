# Backup Strategy

## Overview

This document outlines the backup and disaster recovery strategy for the Gates ERP system using MySQL.

## Backup Types

### 1. Database Backups

#### Automated Daily Backups
- **Frequency**: Daily at 2:00 AM
- **Retention**: 30 days
- **Type**: Full database dump
- **Storage**: S3-compatible storage or local backup server

#### Binary Log Backups (Point-in-Time Recovery)
- **Configuration**: Binary logging enabled
- **Retention**: 7 days of binary logs
- **Recovery Point Objective (RPO)**: 1 hour

#### Backup Script

```bash
#!/bin/bash
# Daily backup script for MySQL

BACKUP_DIR="/backups/mysql"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="gates_erp"
DB_USER="gates_user"
DB_PASSWORD="password"

# Create backup directory
mkdir -p $BACKUP_DIR

# Full backup using mysqldump
mysqldump -h localhost -u $DB_USER -p$DB_PASSWORD \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/backup_$DATE.sql

# Upload to S3 (if configured)
# aws s3 cp $BACKUP_DIR/backup_$DATE.sql.gz s3://backups/gates-erp/

# Remove backups older than 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

### 2. Application Code Backups

- **Method**: Git repository
- **Frequency**: Continuous (on every commit)
- **Retention**: Permanent
- **Storage**: Git repository (GitHub/GitLab)

### 3. Configuration Backups

- **Frequency**: Weekly
- **Retention**: 90 days
- **Includes**:
  - Environment variables (encrypted)
  - Kubernetes manifests
  - Docker Compose files
  - Configuration files

### 4. Redis Backups

- **Frequency**: Daily
- **Type**: RDB snapshot
- **Retention**: 7 days
- **Note**: Redis is primarily cache, data loss acceptable

## Backup Procedures

### Manual Backup

```bash
# Database backup
mysqldump -h localhost -u gates_user -p gates_erp > backup.sql

# Compressed backup
mysqldump -h localhost -u gates_user -p gates_erp | gzip > backup.sql.gz

# Restore from backup
mysql -h localhost -u gates_user -p gates_erp < backup.sql

# Restore from compressed backup
gunzip < backup.sql.gz | mysql -h localhost -u gates_user -p gates_erp
```

### Automated Backup Setup

#### Using Cron

```bash
# Add to crontab (crontab -e)
0 2 * * * /path/to/backup-script.sh
```

#### Using MySQL Event Scheduler (Limited)

MySQL Event Scheduler can't directly run mysqldump, so use cron or external scheduler.

## Recovery Procedures

### Full Database Restore

```bash
# Stop application
systemctl stop gates-backend

# Drop existing database (if needed)
mysql -h localhost -u root -p -e "DROP DATABASE IF EXISTS gates_erp;"

# Create new database
mysql -h localhost -u root -p -e "CREATE DATABASE gates_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Restore from backup
mysql -h localhost -u gates_user -p gates_erp < backup.sql

# Run migrations (if needed)
cd gates-backend
npm run prisma:migrate deploy

# Start application
systemctl start gates-backend
```

### Point-in-Time Recovery (Using Binary Logs)

```bash
# Stop MySQL
systemctl stop mysql

# Restore base backup
mysql -h localhost -u root -p gates_erp < backup.sql

# Apply binary logs up to specific time
mysqlbinlog --stop-datetime="2024-01-15 14:30:00" \
  /var/lib/mysql/mysql-bin.* | mysql -h localhost -u root -p gates_erp

# Or restore to specific position
mysqlbinlog --stop-position=12345 \
  /var/lib/mysql/mysql-bin.* | mysql -h localhost -u root -p gates_erp

# Start MySQL
systemctl start mysql
```

**Note**: Binary logging must be enabled in MySQL configuration:
```ini
[mysqld]
log-bin=mysql-bin
binlog-format=ROW
expire_logs_days=7
```

## Backup Testing

### Monthly Restore Test

1. **Schedule**: First Saturday of each month
2. **Procedure**:
   - Restore backup to test environment
   - Verify data integrity
   - Test application functionality
   - Document results

### Test Checklist

- [ ] Backup restored successfully
- [ ] Database schema matches production
- [ ] Data integrity verified
- [ ] Application starts correctly
- [ ] Critical operations work
- [ ] Reports generate correctly

## Disaster Recovery Plan

### RTO (Recovery Time Objective): 4 hours
### RPO (Recovery Point Objective): 1 hour

### Recovery Steps

1. **Assess Damage**
   - Identify affected systems
   - Determine data loss extent
   - Estimate recovery time

2. **Restore Infrastructure**
   - Provision new servers if needed
   - Restore database from backup
   - Restore application code
   - Restore configuration

3. **Verify Integrity**
   - Run integrity checks
   - Verify data consistency
   - Test critical operations

4. **Resume Operations**
   - Start application services
   - Monitor for issues
   - Notify stakeholders

## Backup Monitoring

### Health Checks

- Monitor backup job success/failure
- Alert on backup failures
- Monitor backup storage usage
- Verify backup file integrity

### Alerts

- Backup job failed
- Backup storage full (>80%)
- Backup older than 24 hours
- Restore test failed

## Data Retention Policies

### Database Backups
- **Daily**: 30 days
- **Weekly**: 12 weeks
- **Monthly**: 12 months

### Audit Logs
- **Active**: 90 days
- **Archive**: 1 year
- **Permanent**: Critical events only

### Activity Logs
- **Active**: 30 days
- **Archive**: 90 days

## Compliance

### GDPR Requirements
- Personal data backups encrypted
- Retention policies enforced
- Right to deletion respected

### Industry Standards
- SOC 2 compliance
- Regular backup testing
- Documented procedures

---

**Last Updated**: Based on current backup setup
**Next Review**: Quarterly

