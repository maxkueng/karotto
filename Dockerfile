# syntax=docker/dockerfile:1
ARG NODE_VERSION=24

# JavaScript is platform independent, so the build runs natively on the build host
# even when the target is another architecture.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
COPY packages/cli/package.json packages/cli/
RUN npm ci
COPY . .
RUN npm run build

# Runtime dependencies are installed on the target platform so native modules match.
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
COPY packages/cli/package.json packages/cli/
# pglite is a test-only database that npm keeps anyway as an optional peer of drizzle.
RUN npm ci --omit=dev --workspace @karotto/server --workspace @karotto/cli \
    && rm -rf node_modules/@electric-sql \
    && mkdir -p packages/server/node_modules packages/cli/node_modules \
    && npm cache clean --force

FROM node:${NODE_VERSION}-alpine
LABEL org.opencontainers.image.title="karotto" \
      org.opencontainers.image.description="Habitica's task mechanics without the game: API, web app and CLI in one image" \
      org.opencontainers.image.source="https://github.com/maxkueng/karotto" \
      org.opencontainers.image.licenses="GPL-3.0-only"
ENV NODE_ENV=production \
    STATIC_DIR=/app/web \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=deps /app/packages/cli/node_modules ./packages/cli/node_modules
COPY --from=build /app/packages/server/package.json ./packages/server/package.json
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/server/drizzle ./packages/server/drizzle
COPY --from=build /app/packages/cli/package.json ./packages/cli/package.json
COPY --from=build /app/packages/cli/dist ./packages/cli/dist
COPY --from=build /app/packages/web/dist ./web
COPY deploy/docker/karotto-admin deploy/docker/karotto /usr/local/bin/
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/v1/health').then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"
EXPOSE 3000
USER node
CMD ["node", "packages/server/dist/main.js"]
