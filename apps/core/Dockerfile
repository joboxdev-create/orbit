# Build context is the repo root: `docker build -f apps/core/Dockerfile .`
FROM node:20-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @orbit/core... build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/apps/core
EXPOSE 3001
CMD ["node", "dist/main.js"]
