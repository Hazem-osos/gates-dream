# Deployment Runbook

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Code review completed

### Database
- [ ] Migrations tested in staging
- [ ] Backup taken before deployment
- [ ] Rollback plan prepared
- [ ] Database connection strings verified

### Configuration
- [ ] Environment variables set
- [ ] Secrets configured
- [ ] Feature flags reviewed
- [ ] Rate limits configured

### Monitoring
- [ ] Health checks configured
- [ ] Alerts set up
- [ ] Dashboards ready
- [ ] Log aggregation configured

## Deployment Steps

### 1. Build Docker Image

```bash
# Build image
docker build -t gates-backend:latest .

# Tag for registry
docker tag gates-backend:latest registry.example.com/gates-backend:v1.0.0

# Push to registry
docker push registry.example.com/gates-backend:v1.0.0
```

### 2. Deploy to Kubernetes

```bash
# Update image tag in deployment
kubectl set image deployment/gates-backend backend=registry.example.com/gates-backend:v1.0.0

# Or apply full manifest
kubectl apply -f k8s/deployment.yaml

# Check rollout status
kubectl rollout status deployment/gates-backend

# View pods
kubectl get pods -l app=gates-backend
```

### 3. Verify Deployment

```bash
# Check health
curl https://api.example.com/health

# Check metrics
curl https://api.example.com/metrics

# Check logs
kubectl logs -f deployment/gates-backend
```

### 4. Post-Deployment

- [ ] Verify all endpoints responding
- [ ] Check error rates in monitoring
- [ ] Verify database connections
- [ ] Test critical user flows
- [ ] Monitor for 30 minutes

## Rollback Procedure

### Quick Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/gates-backend

# Check status
kubectl rollout status deployment/gates-backend
```

### Database Rollback

```bash
# If migrations need rollback
npm run prisma:migrate:rollback

# Restore from backup if needed
pg_restore -d gates_erp backup.dump
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>

# Common issues:
# - Image pull errors: Check registry access
# - Resource limits: Check CPU/memory
# - Health check failures: Check dependencies
```

### High Error Rates

1. Check application logs
2. Review error patterns
3. Check database performance
4. Verify external service health
5. Review recent changes

### Performance Issues

1. Check metrics dashboard
2. Review slow queries
3. Check cache hit rates
4. Verify resource limits
5. Review connection pool usage

## Emergency Procedures

### Service Down

1. Check health endpoints
2. Review logs for errors
3. Check database connectivity
4. Verify Redis connectivity
5. Check Kubernetes cluster status
6. Escalate if needed

### Data Corruption

1. Stop writes immediately
2. Take database snapshot
3. Restore from backup
4. Verify data integrity
5. Resume operations

---

**Last Updated**: Based on current deployment setup

