#!/bin/bash

# Khởi chạy SurrealDB ở background
echo "Starting SurrealDB in-memory..."
surreal start --user ${USERNAME_DB:-root} --pass ${PASSWORD_DB:-root} --bind 0.0.0.0:8000 memory &

# Chờ cho đến khi cổng 8000 của SurrealDB mở (tối đa 30s)
echo "Waiting for SurrealDB to be ready..."
RETRIES=30
while ! nc -z localhost 8000; do
  sleep 1
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -eq 0 ]; then
    echo "SurrealDB failed to start"
    exit 1
  fi
done

echo "SurrealDB is ready! Starting NestJS..."
# Dùng PORT từ biến môi trường của Render (mặc định thường là 10000 hoặc 3000)
exec node dist/main.js