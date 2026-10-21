FROM node:20-alpine AS builder
WORKDIR /app
ARG BACKEND_PROXY_TARGET=http://gates-backend:10000
ENV BACKEND_PROXY_TARGET=$BACKEND_PROXY_TARGET
# Render starter build VMs are small; allow a larger heap only during `next build`.
ENV NODE_OPTIONS=--max-old-space-size=4096
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
# Starter web instances (~512MB RAM): standalone server only — no full dev node_modules.
ENV NODE_OPTIONS=--max-old-space-size=384
ENV PORT=10000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 10000
CMD ["node", "server.js"]
