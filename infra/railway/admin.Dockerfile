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
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY . .
RUN test -n "$VITE_API_URL" \
  && pnpm build:test-dependencies \
  && pnpm --filter @sale-advisor/admin build

FROM nginxinc/nginx-unprivileged:1.29-alpine AS admin
COPY --from=build --chown=101:101 /workspace/apps/admin/dist /usr/share/nginx/html
COPY --chown=101:101 infra/railway/nginx.conf /etc/nginx/conf.d/default.conf
USER 101
EXPOSE 8080
