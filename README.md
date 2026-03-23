# social-app-backend

## Deploy NestJS + SurrealDB on Render (single Docker service)

Project now includes:
- `Dockerfile`: build backend and install SurrealDB binary
- `docker/start.sh`: start SurrealDB, wait for health, import schema, then run NestJS
- `.dockerignore`: reduce build context

### 1) Create Web Service on Render
- Environment: `Docker`
- Root directory: project root
- Start command: leave empty (uses Docker `CMD`)

### 2) Add environment variables on Render
- `PORT=3000`
- `DB_URL=ws://127.0.0.1:8000/rpc`
- `USERNAME_DB=root`
- `PASSWORD_DB=<strong-password>`
- `NAMESPACE_DB=social_app`
- `DATABASE_NAME=social_app`
- `JWT_SECRET=<your-secret>`
- `JWT_EXPIRES_IN=1d`
- `JWT_EXPIRES_IN_REFRESH=7d`

### 3) Persistent disk (important)
If you want DB data to survive redeploy/restart:
- Attach a Render Disk to your service
- Mount path: `/data`
- `SURREAL_PATH=/data/social_media.db`

Without disk, data inside container is ephemeral and can be lost.

### 4) Local test
```bash
docker build -t social-app-backend .
docker run --rm -p 3000:3000 \
  -e JWT_SECRET=test-secret \
  -e JWT_EXPIRES_IN=1d \
  -e JWT_EXPIRES_IN_REFRESH=7d \
  social-app-backend
```