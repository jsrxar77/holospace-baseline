# ============================================================================
# HOLOSPACE BASELINE SAAS MULTI-TENANT: MULTI-STAGE DOCKERFILE
# ============================================================================

# ----------------------------------------------------------------------------
# ETAPA 1: Builder & Dependencias
# ----------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar utilidades de compilación nativa para better-sqlite3 / crypto si aplican
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps || npm install --omit=dev --legacy-peer-deps

COPY . .

# ----------------------------------------------------------------------------
# ETAPA 2: Runtime de Producción Ligero & Seguro
# ----------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HS_PORT=3001

# Crear directorio de datos persistente con permisos adecuados
RUN mkdir -p /app/data /app/backups && chown -R node:node /app

COPY --chown=node:node --from=builder /app /app

# Ejecutar como usuario no-root por seguridad
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/theme || exit 1

CMD ["node", "server.js"]
