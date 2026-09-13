# MySQL Connection Pooling

## Overview

For MySQL, connection pooling can be handled at multiple levels:
1. **Application Level**: Prisma handles connection pooling automatically
2. **Proxy Level**: MySQL Router or ProxySQL (optional, for advanced setups)

## Prisma Connection Pooling

Prisma automatically manages connection pooling. Configure via `DATABASE_URL`:

```bash
DATABASE_URL="mysql://user:password@host:3306/database?connection_limit=10&pool_timeout=20"
```

### Connection Pool Parameters

- `connection_limit`: Maximum number of connections in the pool (default: varies by Prisma version)
- `pool_timeout`: Maximum time to wait for a connection (seconds)

### Example Configuration

```bash
# Development
DATABASE_URL="mysql://gates_user:password@localhost:3306/gates_erp?connection_limit=5"

# Production
DATABASE_URL="mysql://gates_user:password@mysql-host:3306/gates_erp?connection_limit=20&pool_timeout=10"
```

Prisma production defaults (`src/shared/database/prisma.ts`) are **20 per Node process** (API and `start:workers` each). Size `max_connections` in `infra/mysql/my.cnf` to that ceiling plus admin/backup headroom (**80**), not 1000+.

## ProxySQL (Optional)

For advanced setups with read replicas or connection pooling at the proxy level:

### Installation

```bash
# Docker
docker run --name proxysql \
  -p 6032:6032 \
  -p 6033:6033 \
  -d proxysql/proxysql:latest
```

### Configuration

```ini
[mysql_servers]
mysql_servers =
  (address="mysql-master", port=3306, hostgroup=0, max_connections=100),
  (address="mysql-replica", port=3306, hostgroup=1, max_connections=100)

[mysql_users]
mysql_users =
  (username="gates_user", password="password", default_hostgroup=0)

[mysql_query_rules]
mysql_query_rules =
  (rule_id=1, match_pattern="^SELECT", destination_hostgroup=1, apply=1)
```

### Connection String

```bash
DATABASE_URL="mysql://gates_user:password@proxysql-host:6033/gates_erp"
```

## MySQL Router (Optional)

MySQL Router is Oracle's official routing middleware:

```bash
# Install MySQL Router
# Configure routing rules
# Connect through router port (6446 for read-write, 6447 for read-only)
DATABASE_URL="mysql://gates_user:password@router-host:6446/gates_erp"
```

## Best Practices

1. **Use Prisma's Built-in Pooling**: For most use cases, Prisma's connection pooling is sufficient
2. **Monitor Connections**: Track connection usage and adjust `connection_limit` accordingly
3. **Connection Timeouts**: Set appropriate `pool_timeout` to prevent hanging requests
4. **Read Replicas**: Use ProxySQL or MySQL Router for read/write splitting

## Monitoring

### Check Active Connections

```sql
-- MySQL
SHOW PROCESSLIST;
SHOW STATUS LIKE 'Threads_connected';
```

### Prisma Metrics

Monitor Prisma connection pool metrics in your application logs or monitoring system.

## Notes

- Prisma handles connection pooling automatically - no additional setup needed for basic use
- ProxySQL/MySQL Router are optional and mainly for advanced setups with read replicas
- Connection pooling is simpler in MySQL compared to PostgreSQL (no session variable issues)

