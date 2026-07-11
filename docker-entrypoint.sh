#!/bin/sh
set -e

echo "=== PinPoint Server Entrypoint ==="

echo "Running database migrations..."
npx sequelize-cli db:migrate --env development
echo "Migrations complete."

exec "$@"
