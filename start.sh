# #!/bin/bash

# # 1. Khởi chạy SurrealDB (SurrealDB 3.x: dùng surrealkv:// — backend "file:" đã bỏ)
# # SURREAL_PATH mặc định khớp Dockerfile; ví dụ: /data/social_media.db → surrealkv:///data/social_media.db
# mkdir -p /data
# chmod 777 /data

# SURREAL_PATH="${SURREAL_PATH:-/data/social_media.db}"

# echo "Starting SurrealDB (surrealkv at ${SURREAL_PATH})..."
# surreal start --user "${SURREAL_USER:-root}" --pass "${SURREAL_PASS:-root}" --bind 0.0.0.0:8000 "surrealkv://${SURREAL_PATH}" &

# # 2. Đợi cổng 8000 mở (có giới hạn để deploy không treo vô hạn khi Surreal lỗi)
# echo "Waiting for SurrealDB (port 8000)..."
# max_wait=120
# elapsed=0
# while ! nc -z localhost 8000; do
#   if [ "$elapsed" -ge "$max_wait" ]; then
#     echo "ERROR: SurrealDB did not open port 8000 within ${max_wait}s. Aborting."
#     exit 1
#   fi
#   sleep 1
#   elapsed=$((elapsed + 1))
# done

# echo "SurrealDB is ready!"

# # 3. Chạy NestJS
# # Render sẽ cấp PORT qua biến môi trường (thường là 10000)
# exec node dist/main.js