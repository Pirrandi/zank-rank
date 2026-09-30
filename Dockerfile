# syntax=docker/dockerfile:1
# Imagen de zank.rank para self-hosted (ver docker-compose.yml y la sección Docker del README).
# Usa `next start` normal (sin output standalone) porque el mismo repo también corre con pm2.

FROM node:22-bookworm-slim AS base
# openssl: requerido por los engines de Prisma. tzdata: hora local del análisis diario (TZ).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates tzdata \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- Dependencias (incluye dev: prisma y tsx se usan en runtime para db push y los scripts) ---
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

# --- Build de Next ---
FROM deps AS builder
COPY . .
RUN npx prisma generate
# Ninguna página se prerenderiza contra la DB, pero Prisma exige la variable definida.
ENV DATABASE_URL=file:/tmp/build.db
RUN npm run build

# --- Runtime ---
FROM base AS runner
ENV NODE_ENV=production \
    DATABASE_URL=file:/data/zank.db

COPY --from=builder /app/package.json /app/package-lock.json /app/next.config.ts /app/tsconfig.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/data ./data
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/zank-entrypoint

# /data es el volumen con la base SQLite; se crea con dueño `node` para que el volumen herede
# esos permisos la primera vez.
RUN mkdir -p /data && chown node:node /data
USER node

EXPOSE 3000
ENTRYPOINT ["zank-entrypoint"]
