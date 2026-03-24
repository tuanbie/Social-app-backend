export type JwtUserPayload = {
  sub: string;
  id: string;
  username: string;
  email: string;
  iat?: number;
  exp?: number;
};

