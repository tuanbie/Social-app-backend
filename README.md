# social-app (backend)

API NestJS kết nối **SurrealDB** (WebSocket), có Swagger, upload qua **Firebase Storage** (tuỳ chọn khi dev).

---

## Yêu cầu

| Thành phần | Ghi chú |
|------------|---------|
| **Node.js** | Khuyến nghị **22.x** (trùng với `Dockerfile`) |
| **npm** | Đi kèm Node |
| **SurrealDB** | Cần khi chạy local (CLI `surreal`) — [cài đặt SurrealDB](https://surrealdb.com/install) |

---

## Cài đặt và chạy trên máy (development)

### Bước 1 — Lấy mã nguồn và cài dependency

```bash
git clone <repo-url>
cd social-app
npm install
```

### Bước 2 — Tạo file `.env` ở thư mục gốc project

Sao chép các biến dưới đây và điền giá trị phù hợp (JWT bắt buộc để đăng nhập / bảo vệ route).

**Database (SurrealDB)**

| Biến | Mô tả | Ví dụ local |
|------|--------|-------------|
| `DB_URL` | WebSocket RPC tới SurrealDB | `ws://127.0.0.1:8000/rpc` |
| `USERNAME_DB` | User root (hoặc user bạn cấu hình) | `root` |
| `PASSWORD_DB` | Mật khẩu | `root` |
| `NAMESPACE_DB` | Namespace | `main` hoặc `social_app` |
| `DATABASE_NAME` | Database | `main` hoặc `social_app` |

**JWT**

| Biến | Mô tả |
|------|--------|
| `JWT_SECRET` | Chuỗi bí mật ký token (bắt buộc) |
| `JWT_EXPIRES_IN` | Thời hạn access token, ví dụ `1d` |
| `JWT_EXPIRES_IN_REFRESH` | Thời hạn refresh token, ví dụ `7d` |

**Server**

| Biến | Mô tả |
|------|--------|
| `PORT` | Cổng HTTP (mặc định `3000` nếu không set) |

**Firebase (upload file — chỉ cần khi dùng tính năng upload)**

| Biến | Mô tả |
|------|--------|
| `FIREBASE_STORAGE_BUCKET` | Tên bucket (bỏ tiền tố `gs://` nếu có) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` hoặc `GOOGLE_APPLICATION_CREDENTIALS` | Đường dẫn file JSON service account |
| Hoặc `FIREBASE_SERVICE_ACCOUNT_JSON` | Toàn bộ JSON một dòng |

Các biến Firebase khác (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, …) được dùng tuỳ cách khởi tạo trong code — xem `src/common/config/appSetting.ts`.

### Bước 3 — Chạy SurrealDB (terminal riêng)

Tạo thư mục lưu dữ liệu và khởi động (ví dụ file DB tại `./data/social_media.db`):

```bash
mkdir -p data
surreal start --log info --user root --pass root "surrealkv://$(pwd)/data/social_media.db"
```

Giữ process này chạy. Mặc định SurrealDB lắng nghe cổng **8000** (khớp `DB_URL` mặc định trong code).

> **Lưu ý:** Script `npm run db:dev` trong `package.json` là ví dụ có đường dẫn cố định; trên máy khác hãy dùng lệnh `surreal start` như trên hoặc chỉnh lại đường dẫn file DB cho đúng.

### Bước 4 — Áp dụng schema (migrate)

Khi DB đã chạy và biến môi trường đã khớp (`NAMESPACE_DB`, `DATABASE_NAME`, …):

```bash
npm run db:migrate
```

### Bước 5 — Chạy API ở chế độ watch

```bash
npm run start:dev
```

- **HTTP API / Swagger:** `http://localhost:3000/api-docs` (hoặc cổng bạn set ở `PORT`)
- **Proxy Surrealist → SurrealDB:** `http://localhost:3000/rpc` (WebSocket được proxy tới `localhost:8000`)

---

## Build và chạy production trên máy

```bash
npm run build
npm run start:prod
```

Cần SurrealDB đang chạy và `.env` đầy đủ giống bước development.

---

## Script npm thường dùng

| Lệnh | Ý nghĩa |
|------|---------|
| `npm run start:dev` | Dev, tự reload |
| `npm run start:debug` | Dev + debugger |
| `npm run build` | Build `dist/` |
| `npm run start:prod` | `node dist/main` |
| `npm run db:migrate` | Chạy schema lên DB đang kết nối |
| `npm run db:pull-schema` | Kéo schema từ DB (nếu dùng workflow đó) |
| `npm run lint` | ESLint |
| `npm test` | Jest |

---

## Docker và deploy (Render)

Project có `Dockerfile`: image chứa Node + binary SurrealDB, script khởi động DB rồi chạy NestJS.

### Triển khai Web Service trên Render

1. **Loại dịch vụ:** Docker, root directory = thư mục gốc repo.
2. **Start command:** để trống (dùng `CMD` trong `Dockerfile`).
3. **Biến môi trường** (tối thiểu): `PORT`, `DB_URL` (thường `ws://127.0.0.1:8000/rpc` trong cùng container), `USERNAME_DB`, `PASSWORD_DB`, `NAMESPACE_DB`, `DATABASE_NAME`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_EXPIRES_IN_REFRESH`.
4. **Ổ đĩa bền (khuyến nghị):** gắn disk, mount ví dụ `/data`, set `SURREAL_PATH=/data/social_media.db` để dữ liệu không mất khi redeploy.

### Kiểm tra Docker ở local

```bash
docker build -t social-app-backend .
docker run --rm -p 3000:3000 \
  -e JWT_SECRET=test-secret \
  -e JWT_EXPIRES_IN=1d \
  -e JWT_EXPIRES_IN_REFRESH=7d \
  -e USERNAME_DB=root \
  -e PASSWORD_DB=root \
  -e NAMESPACE_DB=social_app \
  -e DATABASE_NAME=social_app \
  social-app-backend
```

Sau đó mở `http://localhost:3000/api-docs`.

---

## Cấu trúc liên quan

- Cấu hình app: `src/common/config/appSetting.ts`
- Schema Surreal: `src/database/schema.surql`
- Script khởi động trong container: `start.sh` (root project; đồng bộ với flow trong `docker/` nếu có)
