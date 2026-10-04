FROM node:20-alpine AS builder
WORKDIR /app
ARG BACKEND_PROXY_TARGET=http://gates-backend.railway.internal:3001
ENV BACKEND_PROXY_TARGET=$BACKEND_PROXY_TARGET
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
EXPOSE 8080
CMD ["npm", "run", "railway:start"]
