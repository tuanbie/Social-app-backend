import 'dotenv/config';
export const development: boolean = true;

export const appSettings = {
  port: process.env.PORT || 3000,
  db: {
    url: process.env.DB_URL,
    username: process.env.USERNAME_DB,
    password: process.env.PASSWORD_DB,
    namespace: process.env.NAMESPACE_DB,
    database: process.env.DATABASE_NAME,
  } as any,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
    expiresInRefresh: process.env.JWT_EXPIRES_IN_REFRESH,
  },
};
