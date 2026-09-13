# Production infrastructure (reference)

Choose one pattern and commit real values only in your secrets manager — not in git.

## Option A — Single VM + Docker Compose

1. Copy `docker-compose.stack.example.yml` to the server as `docker-compose.yml`.
2. Set environment variables / `.env` for MySQL, Redis, backend, and (optional) Keycloak.
3. Put TLS on a reverse proxy (Caddy, Nginx, Traefik) in front of the app and API.

MySQL 8.x memory profile: `infra/mysql/my.cnf` (dedicated 8 GiB host — 6G buffer pool, `max_connections=80`). Shared laptops / local Compose use `infra/mysql/my.dev.cnf`. Restart `mysqld` after changing either file.

## Option B — Managed cloud

- **Database:** AWS RDS / Cloud SQL / Azure Database for MySQL 8+
- **Cache/queue:** ElastiCache Redis or Memorystore
- **Auth:** Managed Keycloak or your IdP
- **App:** Container service (ECS, Cloud Run, AKS) using the backend `Dockerfile`

## Environment checklist

| Variable | Service | Notes |
|----------|---------|--------|
| `DATABASE_URL` | Backend | MySQL connection string |
| `REDIS_URL` | Backend | Required if `REDIS_ENABLED=true` |
| `FRONTEND_URL` | Backend | Primary SPA origin for CORS |
| `CORS_ORIGINS` | Backend | Optional comma-separated extra origins |
| `KEYCLOAK_*` | Backend | If `KEYCLOAK_ENABLED=true` |
| `NEXT_PUBLIC_API_URL` | Frontend | e.g. `https://api.example.com/api/v1` |

See also: `gates-backend/docs/production-environment.md`, migration **[ROADMAP.md](../docs/migration/ROADMAP.md)** (local + Docker sanity commands).

### Quick local stack (example)

```bash
# Dependencies only (from gates-backend/)
cd gates-backend && docker compose up -d mysql redis

# Or full stack example (from repo root)
cd infra && cp docker-compose.stack.example.yml docker-compose.yml
# configure .env, then:
docker compose up -d --build
```
