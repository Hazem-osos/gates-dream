# Redis Setup Guide

## Overview

Redis is used for two purposes in the ERP system:
1. **Caching** - Store frequently accessed data (items, accounts, etc.)
2. **Job Queues** - BullMQ uses Redis for job queue management

## Installation

### Option 1: Docker (Recommended for Development)

```bash
docker run --name redis-gates \
  -p 6379:6379 \
  -d redis:latest
```

Verify Redis is running:
```bash
docker ps | grep redis
```

### Option 2: Local Installation

**macOS**:
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian**:
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**Windows**:
Download from: https://github.com/microsoftarchive/redis/releases

## Configuration

### Environment Variables

Add to `.env`:

```bash
# Redis Configuration
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379

# Or specify host and port separately (not needed if using REDIS_URL)
# REDIS_HOST=localhost
# REDIS_PORT=6379
```

### Connection String Format

```
redis://[password@]host:port[/database]
```

Examples:
- `redis://localhost:6379` (no password)
- `redis://:password@localhost:6379` (with password)
- `redis://localhost:6379/0` (with database number)

## Testing Connection

### Using Redis CLI

```bash
# If using Docker
docker exec -it redis-gates redis-cli

# If installed locally
redis-cli
```

Test commands:
```bash
PING  # Should return PONG
SET test "hello"
GET test  # Should return "hello"
```

### Using Node.js

```javascript
const redis = require('ioredis');
const client = new Redis('redis://localhost:6379');

client.ping().then(result => {
  console.log(result); // Should print "PONG"
});
```

## Production Considerations

### 1. Password Protection

Set password in Redis:

```bash
# Edit redis.conf
requirepass your-strong-password

# Or use environment variable
REDIS_PASSWORD=your-strong-password
```

Update connection string:
```bash
REDIS_URL=redis://:your-strong-password@localhost:6379
```

### 2. Persistence

Configure Redis persistence (RDB or AOF):

```bash
# Edit redis.conf
save 900 1      # Save after 900 seconds if at least 1 key changed
save 300 10     # Save after 300 seconds if at least 10 keys changed
save 60 10000   # Save after 60 seconds if at least 10000 keys changed

appendonly yes  # Enable AOF persistence
```

### 3. Memory Limits

Set max memory and eviction policy:

```bash
# Edit redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru  # Evict least recently used keys
```

### 4. High Availability

For production, consider Redis Sentinel or Redis Cluster:

- **Redis Sentinel**: Provides high availability and automatic failover
- **Redis Cluster**: Provides automatic sharding and high availability

## Monitoring

### Redis Info

```bash
redis-cli INFO
```

Key metrics to monitor:
- `used_memory` - Memory used by Redis
- `connected_clients` - Number of connected clients
- `total_commands_processed` - Total commands processed
- `keyspace_hits` / `keyspace_misses` - Cache hit/miss ratio

### Redis Monitor

Watch commands in real-time:
```bash
redis-cli MONITOR
```

## Troubleshooting

### Connection Refused

- Check Redis is running: `docker ps | grep redis` or `redis-cli ping`
- Verify port is correct: `netstat -an | grep 6379`
- Check firewall settings

### Out of Memory

- Increase Redis max memory
- Adjust eviction policy
- Clear old cache entries

### Slow Performance

- Check memory usage
- Monitor command execution time
- Consider Redis cluster for horizontal scaling

## Cache Management

### Clear All Cache

```bash
redis-cli FLUSHALL
```

### Clear Specific Patterns

```bash
# Clear all cache keys
redis-cli --scan --pattern "cache:*" | xargs redis-cli DEL

# Clear specific module cache
redis-cli --scan --pattern "cache:inventory:*" | xargs redis-cli DEL
```

## Best Practices

1. **TTL**: Always set TTL on cache entries
2. **Key Naming**: Use consistent naming patterns (e.g., `cache:module:resource:id`)
3. **Monitoring**: Monitor cache hit/miss ratio
4. **Invalidation**: Invalidate cache on updates
5. **Memory**: Monitor memory usage and set limits
6. **Persistence**: Configure persistence for job queues

## Next Steps

Once Redis is configured:
1. ✅ Caching is operational
2. ✅ Job queues can process heavy tasks
3. ✅ System performance improved
4. Ready for production deployment

For more information, see:
- Redis Documentation: https://redis.io/documentation
- BullMQ Documentation: https://docs.bullmq.io/
