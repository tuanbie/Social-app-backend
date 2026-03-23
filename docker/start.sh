#!/bin/sh
set -eu

mkdir -p /data

echo "Starting SurrealDB..."
surreal start \
  --log info \
  --user "${USERNAME_DB}" \
  --pass "${PASSWORD_DB}" \
  "surrealkv://${SURREAL_PATH}" &

DB_PID=$!

cleanup() {
  kill "$DB_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

echo "Waiting for SurrealDB to be ready..."
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:8000/health" >/dev/null 2>&1; then
    echo "SurrealDB is ready."
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo "SurrealDB failed to become ready in time."
    exit 1
  fi
done

echo "Applying schema (idempotent)..."
surreal import \
  --conn "http://127.0.0.1:8000" \
  --user "${USERNAME_DB}" \
  --pass "${PASSWORD_DB}" \
  --ns "${NAMESPACE_DB}" \
  --db "${DATABASE_NAME}" \
  /app/dist/database/schema.surql || true

echo "Starting backend app..."
node dist/main
