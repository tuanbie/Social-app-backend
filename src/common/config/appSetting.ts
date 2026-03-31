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
};
