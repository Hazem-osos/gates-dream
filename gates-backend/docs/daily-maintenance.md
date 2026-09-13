# Daily Maintenance Scheduling

## Overview

Daily maintenance tasks include:
1. Refresh materialized views (account balances)
2. Create audit checkpoints
3. Purge old activity logs

## Using pg_cron (PostgreSQL Extension)

### Enable pg_cron

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Schedule Daily Maintenance

```sql
-- Run at 2 AM daily
SELECT cron.schedule(
  'daily-maintenance',
  '0 2 * * *',
  $$SELECT run_daily_maintenance(365);$$
);
```

### Manual Execution

```sql
SELECT run_daily_maintenance(365);
```

## Using External Scheduler (cron/systemd)

### Cron Job

```bash
# /etc/cron.daily/gates-maintenance
0 2 * * * psql -h localhost -U app_admin -d gates_db -c "SELECT run_daily_maintenance(365);"
```

### Systemd Timer

Create `/etc/systemd/system/gates-maintenance.service`:

```ini
[Unit]
Description=Gates Daily Maintenance
After=postgresql.service

[Service]
Type=oneshot
User=postgres
ExecStart=/usr/bin/psql -h localhost -U app_admin -d gates_db -c "SELECT run_daily_maintenance(365);"
```

Create `/etc/systemd/system/gates-maintenance.timer`:

```ini
[Unit]
Description=Gates Daily Maintenance Timer
Requires=gates-maintenance.service

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start:

```bash
systemctl enable gates-maintenance.timer
systemctl start gates-maintenance.timer
```

## Individual Tasks

### Refresh Materialized Views

```sql
SELECT refresh_mv_account_balance();
```

### Create Audit Checkpoint

```sql
SELECT create_audit_checkpoint();
```

### Purge Activity Logs

```sql
-- Purge logs older than 365 days (non-legal-hold)
SELECT purge_activity_log(365);
```

## Monitoring

Check last execution:

```sql
SELECT * FROM cron.job_run_details WHERE jobname = 'daily-maintenance' ORDER BY start_time DESC LIMIT 1;
```

