#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  echo "Seeding system categories..."
  npx prisma db seed
fi

if [ "${RUN_DEMO_SEED:-false}" = "true" ]; then
  if [ "${ALLOW_DEMO_SEED:-false}" != "true" ]; then
    echo "RUN_DEMO_SEED is true but ALLOW_DEMO_SEED is not — skipping demo seed."
    exit 1
  fi
  echo "Seeding OAT demo users..."
  npm run prisma:seed:demo
fi

echo "Starting API..."
exec "$@"
