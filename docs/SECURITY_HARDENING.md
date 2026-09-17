# Security hardening checklist

## Application

- [x] CORS restricted to `FRONTEND_URL` + optional `CORS_ORIGINS` (`gates-backend/src/shared/config/cors-options.ts`)
- [x] CSRF token on mutating API calls (existing middleware)
- [x] Helmet security headers (`gates-backend/src/app.ts`)
- [ ] Rotate JWT / Keycloak client secrets on schedule
- [ ] Dependency scanning: `npm audit` in CI for `gates-backend` and `gates-web`

## Edge / network

- [ ] WAF (e.g. Cloudflare) in front of public API and SPA
- [ ] Rate limiting tuned per route (auth stricter than read-only GETs)
- [ ] Private subnets for DB and Redis; no public DB ports

## Operations

- [ ] Secrets in vault / managed secrets, not git
- [ ] Backup encryption and tested restores
- [ ] Incident runbook for credential leak

## CI

- [ ] Block merge on failing tests (`jest`, `next build`, `tsc --noEmit`)
