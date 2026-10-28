# Gates API + workers (compiled dist/ boot via scripts/railway-start.mjs; tsx fallback)
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate

# Compile src/ to dist/ (esbuild, ~1 s). scripts/railway-start.mjs then runs
# `node dist/…` instead of tsx, and WEB_CONCURRENCY>1 enables cluster mode.
# Rollback without rebuilding: set GATES_RUNTIME=tsx on the service.
RUN node scripts/build-dist.mjs

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health/live').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "scripts/railway-start.mjs"]
