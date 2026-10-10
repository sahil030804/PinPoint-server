#!/bin/sh
set -e

echo "=== PinPoint Server Entrypoint ==="

echo "Running database migrations (env: ${NODE_ENV:-development})..."
npx sequelize-cli db:migrate --env "${NODE_ENV:-development}"
echo "Migrations complete."

exec "$@"
