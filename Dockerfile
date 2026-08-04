# syntax=docker/dockerfile:1.7

FROM node:24.18.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate
WORKDIR /workspace

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/e2e/package.json packages/e2e/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN pnpm build:test-dependencies \
  && pnpm --filter @sale-advisor/api build \
  && pnpm --filter @sale-advisor/worker build \
  && pnpm --filter @sale-advisor/database build
RUN pnpm --filter @sale-advisor/api deploy --prod /deploy/api \
  && pnpm --filter @sale-advisor/worker deploy --prod /deploy/worker \
  && pnpm --filter @sale-advisor/database deploy --prod /deploy/migrate

FROM node:24.18.0-bookworm-slim AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /deploy/api ./
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM node:24.18.0-bookworm-slim AS worker
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /deploy/worker ./
USER node
CMD ["node", "dist/main.js"]

FROM node:24.18.0-bookworm-slim AS migrate
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /deploy/migrate ./
USER node
CMD ["node", "dist/migrate.js"]

FROM node:24.18.0-bookworm-slim AS railway-runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /deploy/api ./api
COPY --from=build --chown=node:node /deploy/worker ./worker
COPY --from=build --chown=node:node /deploy/migrate ./migrate
USER node
EXPOSE 3000
CMD ["node", "api/dist/main.js"]
