# ─────────────────────────────────────────────────────────────
# Stage 1 — build: install all dependencies, build API and web
# ─────────────────────────────────────────────────────────────
FROM node:24.18-alpine AS build

# corepack installs the pnpm version pinned in package.json "packageManager".
# Without that field it pulls the latest pnpm, whose stricter build-script
# policy breaks `pnpm install --frozen-lockfile` with ERR_PNPM_IGNORED_BUILDS.
RUN corepack enable

WORKDIR /app

# Copy manifests before sources so the install layer stays cached
# when only application code changes.
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm nx build api --configuration=production \
 && pnpm nx build web --configuration=production \
 && pnpm exec tsc -p apps/api/tsconfig.migrations.json

# ─────────────────────────────────────────────────────────────
# Stage 2 — runtime: only what is needed to run
# ─────────────────────────────────────────────────────────────
FROM node:24.18-alpine AS runtime

RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

# `nx build api` emits a trimmed package.json with only the bundle's runtime
# dependencies (generatePackageJson), keeping the Angular/Nx toolchain out of the image.
COPY --from=build /app/dist/apps/api/package.json ./package.json
COPY --from=build /app/dist/apps/api/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --prod --frozen-lockfile

COPY --from=build /app/dist/apps/api ./dist/apps/api
COPY --from=build /app/dist/apps/web ./dist/apps/web

# Migrations run from precompiled JavaScript. ts-node is a devDependency, and
# Node's type stripping uses ESM semantics, which rejects the directory import
# `import * as entities from './entities'`.
COPY --from=build /app/dist/migrations ./dist/migrations
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Receipt uploads must live on a volume to survive redeploys.
ENV UPLOAD_DIR=/data/uploads
RUN mkdir -p /data/uploads && chown -R node:node /data

# Run as an unprivileged user to limit the impact of an app compromise.
USER node

ENV PORT=3000
ENV SERVE_STATIC=true
EXPOSE 3000

# Use Node's fetch against the app's health endpoint; no curl in the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
