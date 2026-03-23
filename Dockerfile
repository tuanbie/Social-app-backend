FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

# Install runtime helpers and SurrealDB CLI/server binary
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && curl -sSf https://install.surrealdb.com | sh \
  && mv /root/.surrealdb/surreal /usr/local/bin/surreal

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/src/database/schema.surql ./dist/database/schema.surql
COPY docker/start.sh /app/docker/start.sh

RUN chmod +x /app/docker/start.sh

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
