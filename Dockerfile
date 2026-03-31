# Stage 1: Lấy binary của SurrealDB
FROM surrealdb/surrealdb:latest AS surrealdb_bin

# Stage 2: Build NestJS
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
# Dùng npm ci để cài đặt chính xác theo lockfile
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Runtime
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

# 1. Cài đặt các thư viện hệ thống cần thiết (netcat để check port)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# 2. Copy binary SurrealDB từ stage 1
COPY --from=surrealdb_bin /surreal /usr/local/bin/surreal

# 3. Copy dependencies (chỉ lấy production)
COPY package*.json ./
RUN npm ci --omit=dev

# 4. Copy build artifacts và schema
COPY --from=build /app/dist ./dist
# Đảm bảo file này tồn tại trong source của bạn
COPY --from=build /app/src/database/schema.surql ./dist/database/schema.surql

# 5. Copy start.sh từ gốc thư mục (theo screenshot của bạn)
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Thiết lập môi trường
ENV NODE_ENV=production
# Render sẽ tự động gán PORT, nhưng ta dự phòng là 3000
ENV PORT=3000
ENV DB_URL=ws://127.0.0.1:8000/rpc
ENV SURREAL_PATH=/data/social_media.db

# /data: tạo sẵn thư mục; trên Railway gắn Volume tại /data (Settings → Volumes), không dùng VOLUME trong Dockerfile
RUN mkdir -p /data && chmod 777 /data

EXPOSE 3000

# Chạy script khởi động
CMD ["./start.sh"]