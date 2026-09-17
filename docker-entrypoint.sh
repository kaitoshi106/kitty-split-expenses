#!/bin/sh
set -e

# Run migrations as a separate step before the API starts, rather than on app
# boot, so multiple instances never migrate the schema concurrently. TypeORM
# `synchronize` stays off because it can drop columns.
echo "→ Running migrations..."
# Compiled in the build stage; tsc keeps the source tree layout (apps/ and libs/
# share the repo root), hence the deep path.
node ./node_modules/typeorm/cli.js migration:run \
  -d dist/migrations/apps/api/src/data-source.js

echo "→ Starting API..."
exec node dist/apps/api/main.js
