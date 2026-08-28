#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  echo "Seeding database..."
  npx prisma db seed
fi

echo "Starting API..."
exec "$@"
