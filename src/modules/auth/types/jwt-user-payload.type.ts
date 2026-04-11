export type JwtUserPayload = {
  sub: string;
  id: string;
  username: string;
  email: string;
  /** ID phiên bản token — dùng revoke (Redis) khi logout */
  jti?: string;
  iat?: number;
  exp?: number;
};

