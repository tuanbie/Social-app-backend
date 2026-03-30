#!/bin/bash

# Khởi chạy SurrealDB ở background
# Thử dùng memory trước để loại trừ lỗi ổ đĩa/quyền hạn
echo "Starting SurrealDB in-memory..."
surreal start --user root --pass root --bind 0.0.0.0:8000 memory &

# Chờ tối đa 5 giây thôi, không đợi mãi mãi
sleep 5

echo "Starting NestJS..."
# Dùng PORT từ biến môi trường của Render
exec node dist/main.js
