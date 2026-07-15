# Wayfinder Web — frontend + admin/sites API in one Node container.
#
# Build from the MONOREPO ROOT (the app depends on pnpm workspace packages):
#   docker build -f artifacts/wayfinder-web/deploy/Dockerfile -t wayfinder-web .
#
# Run (ADMIN_PASSWORD is required):
#   docker run -d -p 8080:3000 -e ADMIN_PASSWORD=change-me \
#     -v wayfinder-data:/data --name wayfinder wayfinder-web

FROM node:22-alpine

# Pin pnpm to the same major version the project is developed with —
# newer majors turn the "ignored build scripts" warning into a hard error.
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# Copy workspace manifests first for better layer caching.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY lib ./lib
COPY artifacts/wayfinder-web ./artifacts/wayfinder-web

RUN pnpm install --frozen-lockfile --filter @workspace/wayfinder-web... || \
    pnpm install --config.dangerouslyAllowAllBuilds=true --filter @workspace/wayfinder-web...

# BASE_PATH=/ because on your own server the app lives at the domain root.
ENV BASE_PATH=/
ENV PORT=3000
RUN pnpm --filter @workspace/wayfinder-web run build

# Site data + uploaded floor plans live here — mount a volume at /data.
ENV WAYFINDER_DATA_DIR=/data
ENV NODE_ENV=production
ENV SERVE_STATIC=1

EXPOSE 3000

WORKDIR /app/artifacts/wayfinder-web
CMD ["pnpm", "exec", "tsx", "server/index.ts"]
