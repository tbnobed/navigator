# Wayfinder Web — static build served by nginx.
#
# Build from the MONOREPO ROOT (the app depends on pnpm workspace packages):
#   docker build -f artifacts/wayfinder-web/deploy/Dockerfile -t wayfinder-web .
#
# Run:
#   docker run -d -p 8080:80 --name wayfinder wayfinder-web

# ---- Stage 1: build ----
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests first for better layer caching.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY lib ./lib
COPY artifacts/wayfinder-web ./artifacts/wayfinder-web

RUN pnpm install --frozen-lockfile --filter @workspace/wayfinder-web... || \
    pnpm install --filter @workspace/wayfinder-web...

# BASE_PATH=/ because on your own server the app lives at the domain root.
ENV BASE_PATH=/
ENV PORT=3000
RUN pnpm --filter @workspace/wayfinder-web run build

# ---- Stage 2: serve ----
FROM nginx:alpine

COPY artifacts/wayfinder-web/deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/artifacts/wayfinder-web/dist/public /usr/share/nginx/html

EXPOSE 80
