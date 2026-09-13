# Production environment

## Required

- `NODE_ENV=production`
- `DATABASE_URL` — MySQL 8+ URL
- `PORT` — default `3001`
- `FRONTEND_URL` — canonical browser origin (e.g. `https://erp.example.com`)

## CORS

- `CORS_ORIGINS` — optional comma-separated list of extra allowed origins (staging, admin subdomain).
- Example: `https://app.example.com,https://staging.example.com`

## Redis & workers

- `REDIS_ENABLED=true` and `REDIS_URL` for cache, rate limits, and BullMQ workers.
- Run API and worker processes per `gates-backend` README (`start:workers`).

## Keycloak

- Set `KEYCLOAK_ENABLED=true` and all `KEYCLOAK_*` variables when using JWT from Keycloak.

## Frontend

- Build `gates-web` with `NEXT_PUBLIC_API_URL=https://your-api-host/api/v1`.

## TLS

- Terminate TLS at the reverse proxy or load balancer; forward to Node over HTTP inside the private network.
