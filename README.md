# Gates Dream

Next.js ERP (`gates-web`) + Express/Prisma API (`gates-backend`) on **MySQL**.

This repo is set up for a Railway test deploy: two Node services + Railway MySQL. Redis, MQTT, and Keycloak stay off.

Public repo: [Hazem-osos/gates-dream](https://github.com/Hazem-osos/gates-dream)

## Railway (for testers)

Create one Railway project from this GitHub repo, then add **three** services:

| Service | Root directory | Notes |
|---|---|---|
| `MySQL` | — | Railway MySQL plugin |
| `gates-backend` | `gates-backend` | API. Start command is already in `railway.json` |
| `gates-web` | `gates-web` | Frontend testers open this URL |

Copy variables from [`railway.env.example`](./railway.env.example). Name the Node services exactly `gates-backend` and `gates-web` so the `${{…}}` references resolve.

Required on **gates-backend**:

- `DATABASE_URL=${{MySQL.MYSQL_URL}}` (or leave it blank — boot maps `MYSQL_URL` automatically)
- `JWT_DEV_SECRET` — 16+ random characters (password login)
- `ENCRYPTION_KEY` — 32+ random characters
- `FRONTEND_URL=https://${{gates-web.RAILWAY_PUBLIC_DOMAIN}}`
- `CORS_ALLOW_RAILWAY=true`
- `KEYCLOAK_ENABLED=false`, `REDIS_ENABLED=false`, `MQTT_ENABLED=false`
- `API_AUTH_MODE=enforce`
- First boot: `SEED_ON_BOOT=true`, `ALLOW_PROD_SEED=true`, and a `SEED_OWNER_PASSWORD` you share with testers

Required on **gates-web** (mark `BACKEND_PROXY_TARGET` as **available at build time**):

- `NEXT_PUBLIC_AUTH_MODE=enforce`
- `BACKEND_PROXY_TARGET=http://${{gates-backend.RAILWAY_PRIVATE_DOMAIN}}:${{gates-backend.PORT}}`
- Do **not** set `NEXT_PUBLIC_API_URL` — the UI uses same-origin `/api/v1`

Deploy **backend first** (MySQL must be running). After the first successful seed, turn `SEED_ON_BOOT` off so restarts do not re-run seed.

### Tester login

- URL: the `gates-web` public Railway URL
- Email: `owner@example.com`
- Password: the `SEED_OWNER_PASSWORD` you set

## Local

```bash
# API — MySQL required
cd gates-backend
cp .env.example .env
npm ci
npx prisma migrate deploy
npm run seed
npm run dev

# Web — omit NEXT_PUBLIC_API_URL so Next proxies /api/v1
cd gates-web
cp .env.example .env.local
npm ci
npm run dev
```

Do not switch Prisma to PostgreSQL. The ERP database is MySQL.
