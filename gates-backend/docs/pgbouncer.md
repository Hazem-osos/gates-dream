# pgBouncer Configuration

## Transaction Mode Setup

Prisma requires transaction mode for proper connection pooling with pgBouncer.

### Configuration (`pgbouncer.ini`)

```ini
[databases]
gates_db = host=postgres-host port=5432 dbname=gates_db

[pgbouncer]
pool_mode = transaction
max_client_conn = 100
default_pool_size = 20
reserve_pool_size = 5
reserve_pool_timeout = 3
max_db_connections = 50
max_user_connections = 25
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
```

### Connection String

Update `DATABASE_URL` to use pgBouncer:

```bash
DATABASE_URL="postgresql://app_user:password@pgbouncer-host:6432/gates_db?schema=public&sslmode=require&pgbouncer=true&connection_limit=1"
```

### Notes

- `pool_mode = transaction`: Required for Prisma (session vars reset per transaction)
- `connection_limit=1` in Prisma URL: Prevents connection pool conflicts
- Reserve pool: Prevents connection exhaustion under load
- Monitor with: `SHOW POOLS; SHOW STATS;`

