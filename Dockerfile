# Stage 1: Dependencies
# HIGH FIX (INFRA-005): Node.js base image should be pinned to specific patch version.
# Update BASE_NODE_VERSION when pinning: node:22.11-alpine3.21
ARG BASE_NODE_VERSION=22-alpine
FROM node:${BASE_NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
# Prisma 7 requires DATABASE_URL for config loading (even for generate)
ARG DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npm ci
# Prisma 7: generate client to custom output path
# Use --no-install to use the version from node_modules (pinned in package-lock.json)
RUN npx --no-install prisma generate

# Stage 2: Build
FROM node:${BASE_NODE_VERSION} AS builder
ARG APP_VERSION=unknown
ENV APP_VERSION=${APP_VERSION}
LABEL org.opencontainers.image.version="${APP_VERSION}"
LABEL org.opencontainers.image.description="Project Manager UI v1"
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production (minimal runtime)
FROM node:${BASE_NODE_VERSION} AS runner
WORKDIR /app

# Pass ARG from parent stage so APP_VERSION is available in runner (FIX INFRA-007)
ARG APP_VERSION=unknown
ENV NODE_ENV=production
ENV APP_VERSION=${APP_VERSION}

# LOW FIX (INFRA-012): Add standard OCI labels for container provenance
#LABEL org.opencontainers.image.source="https://github.com/gansru/ui_pm"
#LABEL org.opencontainers.image.revision="${APP_VERSION}"
#LABEL org.opencontainers.image.created=""
#LABEL org.opencontainers.image.licenses="MIT"
#LABEL org.opencontainers.image.vendor="gansru"

# Install Prisma CLI locally for migrations (prisma/config module required)
RUN npm install prisma@7 dotenv

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only required files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
# Prisma 7: copy generated client from custom output path
COPY --from=builder /app/prisma/generated ./prisma/generated

# Copy and setup entrypoint script for auto-migrations
COPY --chown=nextjs:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Set ownership to non-root user
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
