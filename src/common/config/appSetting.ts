import 'dotenv/config';
export const development: boolean = true;

export const appSettings = {
  port: process.env.PORT || 3000,
  db: {
    url: process.env.DB_URL ?? 'ws://127.0.0.1:8000/rpc',
    username: process.env.USERNAME_DB ?? 'root',
    password: process.env.PASSWORD_DB ?? 'root',
    namespace: process.env.NAMESPACE_DB ?? 'main',
    database: process.env.DATABASE_NAME ?? 'main',
  } as const,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
    expiresInRefresh: process.env.JWT_EXPIRES_IN_REFRESH,
  },
  /** Firebase Admin — upload Storage */
  firebase: {
    /**
     * Tên bucket (vd. `project.appspot.com` hoặc `project.firebasestorage.app`).
     * Bỏ tiền tố `gs://` nếu copy từ Console.
     */
    storageBucket: (process.env.FIREBASE_STORAGE_BUCKET ?? '')
      .replace(/^gs:\/\//i, '')
      .trim(),
    /** Toàn bộ JSON service account (một dòng), ưu tiên sau file path nếu bạn set cả hai — xem service */
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    /**
     * Đường dẫn tới file JSON (vd. `./simply-english-01-firebase-adminsdk-....json`).
     * Có thể dùng `GOOGLE_APPLICATION_CREDENTIALS` (chuẩn Google) thay cho biến này.
     */
    serviceAccountPath:
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
    /** `true`: gọi makePublic() (bucket/object cần cho phép public đọc). */
    publicRead: process.env.FIREBASE_STORAGE_PUBLIC_READ === 'true',
    /** Khi không public: URL ký, mặc định ~1 năm (ms). */
    signedUrlExpiresMs: parseInt(
      process.env.FIREBASE_SIGNED_URL_EXPIRES_MS ?? String(86400000 * 365),
      10,
    ),
  },
};
