#!/bin/bash

# 1. Khởi chạy SurrealDB ở background
# Lưu ý: --bind 0.0.0.0:8000 là quan trọng để NestJS kết nối được
echo "Starting SurrealDB..."
surreal start --user ${USERNAME_DB:-root} --pass ${PASSWORD_DB:-root} --bind 0.0.0.0:8000 memory &

# 2. Chờ SurrealDB sẵn sàng (kiểm tra cổng 8000)
echo "Waiting for SurrealDB to be ready..."
for i in {1..20}; do
  if nc -z localhost 8000; then
    echo "SurrealDB is up!"
    break
  fi
  echo "Still waiting for SurrealDB..."
  sleep 1
done

# 3. Khởi chạy NestJS
echo "Starting NestJS on port ${PORT:-3000}..."
# Sử dụng exec để NestJS trở thành tiến trình chính (PID 1), nhận được signal từ Render
exec node dist/main.js