# Health Check Troubleshooting Runbook

## Overview

This runbook provides step-by-step procedures for troubleshooting health check failures.

## Health Check Endpoints

- `/health` - Comprehensive health check
- `/health/live` - Liveness probe (Kubernetes)
- `/health/ready` - Readiness probe (Kubernetes)

## Common Issues

### Database Connection Failure

**Symptoms:**
- Health check returns `unhealthy` status
- Database check shows `status: unhealthy`

**Diagnosis:**
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Check connection pool
# Review logs for connection errors
```

**Resolution:**
1. Verify DATABASE_URL is correct
2. Check database server is running
3. Verify network connectivity
4. Check connection pool limits
5. Review database logs for errors

### Redis Connection Failure

**Symptoms:**
- Health check returns `degraded` status
- Redis check shows `status: unhealthy`

**Diagnosis:**
```bash
# Check Redis connectivity
redis-cli -u $REDIS_URL ping

# Check Redis status
redis-cli info
```

**Resolution:**
1. Verify REDIS_URL is correct
2. Check Redis server is running
3. Verify network connectivity
4. Check Redis memory usage
5. Review Redis logs

### Keycloak Connection Failure

**Symptoms:**
- Health check returns `degraded` status
- Keycloak check shows `status: unhealthy`

**Diagnosis:**
```bash
# Check Keycloak health
curl $KEYCLOAK_SERVER_URL/health

# Verify configuration
echo $KEYCLOAK_REALM
echo $KEYCLOAK_CLIENT_ID
```

**Resolution:**
1. Verify Keycloak server is accessible
2. Check Keycloak configuration
3. Verify network connectivity
4. Review Keycloak logs

## Health Check Status Meanings

- **healthy**: All critical dependencies are operational
- **degraded**: Some non-critical dependencies are down, but service can operate
- **unhealthy**: Critical dependencies are down, service cannot operate

## Monitoring

Monitor health check endpoints:
- Set up alerts for `/health` returning unhealthy
- Monitor response times
- Track dependency health over time

## Escalation

If health checks fail:
1. Check application logs
2. Check dependency logs (DB, Redis, Keycloak)
3. Verify infrastructure (network, DNS, etc.)
4. Escalate to infrastructure team if needed

