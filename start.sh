#!/bin/bash

# 1. Khởi chạy SurrealDB ở background
# --user và --pass để thiết lập tài khoản admin ban đầu
# --bind để lắng nghe ở localhost
# $SURREAL_PATH là đường dẫn file db (ví dụ /data/social_media.db)
surreal start --user $USERNAME_DB --pass $PASSWORD_DB --bind 0.0.0.0:8000 file:$SURREAL_PATH &

# 2. Đợi cho đến khi SurrealDB sẵn sàng (Health check)
echo "Waiting for SurrealDB to start..."
while ! curl -s http://127.0.0.1:8000/health > /dev/null; do
    sleep 1
done
echo "SurrealDB is up and running!"

# 3. Import Schema nếu cần (Tùy chọn)
# Nếu bạn muốn tự động tạo table khi deploy:
# surreal import --conn http://127.0.0.1:8000 --user $USERNAME_DB --pass $PASSWORD_DB --ns $NAMESPACE_DB --db $DATABASE_NAME /app/dist/database/schema.surql

# 4. Khởi chạy NestJS
node dist/main.js
