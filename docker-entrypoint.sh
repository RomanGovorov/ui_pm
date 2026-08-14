#!/bin/sh
set -e

# Run database migrations automatically on container startup
echo "Running database migrations..."
./node_modules/.bin/prisma migrate deploy

# Execute the main application command
exec "$@"
