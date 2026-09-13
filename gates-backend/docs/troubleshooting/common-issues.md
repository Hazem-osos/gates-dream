# Troubleshooting Guide - Common Issues

## Database Connection Issues

### Symptoms
- Health check shows database as unhealthy
- Connection timeout errors
- "Too many connections" errors

### Diagnosis
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Check connection count
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check connection pool
# Review pgBouncer logs if using pgBouncer
```

### Resolution
1. Verify DATABASE_URL is correct
2. Check database server is running
3. Review connection pool settings
4. Check for connection leaks
5. Increase connection limit if needed

## Redis Connection Issues

### Symptoms
- Cache not working
- Health check shows Redis as unhealthy
- "Connection refused" errors

### Diagnosis
```bash
# Check Redis connectivity
redis-cli -u $REDIS_URL ping

# Check Redis memory
redis-cli info memory

# Check Redis connections
redis-cli info clients
```

### Resolution
1. Verify REDIS_URL is correct
2. Check Redis server is running
3. Check Redis memory limits
4. Review Redis configuration
5. Restart Redis if needed

## Performance Issues

### Slow API Responses

**Diagnosis:**
- Check `/metrics` endpoint for response times
- Review slow query logs
- Check cache hit rates

**Resolution:**
1. Review slow queries and optimize
2. Add missing indexes
3. Check cache configuration
4. Review database connection pool
5. Consider read replicas for reports

### High Memory Usage

**Diagnosis:**
```bash
# Check process memory
ps aux | grep node

# Check Docker container memory
docker stats gates-backend
```

**Resolution:**
1. Review memory limits
2. Check for memory leaks
3. Optimize data loading
4. Increase container memory if needed

## Authentication Issues

### JWT Token Errors

**Symptoms:**
- 401 Unauthorized errors
- Token validation failures

**Diagnosis:**
- Check token expiration
- Verify Keycloak configuration
- Review token format

**Resolution:**
1. Verify Keycloak is accessible
2. Check KEYCLOAK configuration
3. Verify token signing keys
4. Check token expiration settings

## Error Handling

### Circuit Breaker Open

**Symptoms:**
- Requests failing immediately
- "Circuit breaker is OPEN" errors

**Resolution:**
1. Check dependency health
2. Wait for reset timeout
3. Manually reset if needed
4. Fix underlying issue

### High Error Rates

**Diagnosis:**
- Check `/metrics` for error rates
- Review application logs
- Check error patterns

**Resolution:**
1. Identify error patterns
2. Fix root cause
3. Add retry logic if transient
4. Improve error handling

## Deployment Issues

### Pods Not Starting

**Diagnosis:**
```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

**Common Causes:**
- Image pull errors
- Resource limits
- Health check failures
- Configuration errors

**Resolution:**
1. Check pod events
2. Review logs
3. Verify resource limits
4. Check health check configuration

### Migration Failures

**Symptoms:**
- Database migration errors
- Schema mismatch errors

**Resolution:**
1. Review migration files
2. Check database state
3. Run migrations manually if needed
4. Rollback if necessary

## Cache Issues

### Cache Not Invalidating

**Symptoms:**
- Stale data returned
- Updates not reflected

**Resolution:**
1. Check cache invalidation logic
2. Verify Redis connectivity
3. Manually invalidate cache
4. Review cache key patterns

### Low Cache Hit Rate

**Diagnosis:**
- Check `/metrics` for cache metrics
- Review cache configuration

**Resolution:**
1. Increase cache TTL
2. Review cache key patterns
3. Check cache warming
4. Optimize cache usage

## Monitoring Issues

### Metrics Not Appearing

**Diagnosis:**
- Check `/metrics` endpoint
- Verify Prometheus configuration
- Check service discovery

**Resolution:**
1. Verify metrics collection
2. Check Prometheus scrape config
3. Review network connectivity
4. Check service labels

## Quick Fixes

### Restart Services
```bash
# Docker Compose
docker-compose restart backend

# Kubernetes
kubectl rollout restart deployment/gates-backend
```

### Clear Cache
```bash
redis-cli FLUSHALL
```

### Check Logs
```bash
# Docker
docker-compose logs -f backend

# Kubernetes
kubectl logs -f deployment/gates-backend
```

### Health Check
```bash
curl http://localhost:3001/health
```

---

**For more help, check:**
- Health check troubleshooting: `docs/runbooks/health-check-troubleshooting.md`
- Deployment guide: `docs/runbooks/deployment.md`
- Performance guide: `docs/performance/query-optimization.md`

