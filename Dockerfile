# Stage 1: Lấy binary của SurrealDB
FROM surrealdb/surrealdb:latest AS surrealdb_bin

# Stage 2: Build NestJS
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Runtime
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN mkdir -p /data && chmod 777 /data
# 1. Copy binary của surreal trực tiếp từ stage 1 (Thay thế cho đoạn curl lỗi)
COPY --from=surrealdb_bin /surreal /usr/local/bin/surreal

# 2. Cài đặt các thư viện runtime cần thiết
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/src/database/schema.surql ./dist/database/schema.surql
COPY docker/start.sh /app/docker/start.sh

RUN chmod +x /app/docker/start.sh

# Khai báo Volume để tránh mất data trên Render (nếu bạn có gắn Disk)
VOLUME /data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_URL=ws://127.0.0.1:8000/rpc
ENV USERNAME_DB=root
ENV PASSWORD_DB=root
ENV NAMESPACE_DB=social_app
ENV DATABASE_NAME=social_app
ENV SURREAL_PATH=/data/social_media.db

EXPOSE 3000

CMD ["/app/docker/start.sh"]
