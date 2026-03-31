import { Surreal } from 'surrealdb';
import type { AnyAuth } from 'surrealdb';

export type SurrealDbEnv = {
  url: string;
  username: string;
  password: string;
  namespace: string;
  database: string;
};

function trim(s: string): string {
  return typeof s === 'string' ? s.trim() : s;
}

function envFlag(name: string, alt?: string): boolean {
  const v = (process.env[name] ?? (alt ? process.env[alt] : '') ?? '')
    .toString()
    .toLowerCase()
    .trim();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * - Giữ nguyên `wss://` như `surreal sql --endpoint wss://...` (không ép sang https).
 * - Cloud mà ghi nhầm `ws://` → nâng lên `wss://` (bắt buộc TLS).
 * - Tùy chọn: SURREAL_USE_HTTP=1 → dùng https (HttpEngine), khi cần giống curl REST.
 */
export function normalizeSurrealUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    if (u.hostname.includes('surreal.cloud')) {
      if (u.protocol === 'ws:') {
        u.protocol = 'wss:';
      }
      if (envFlag('SURREAL_USE_HTTP', 'DB_USE_HTTP')) {
        if (u.protocol === 'wss:' || u.protocol === 'ws:') {
          u.protocol = 'https:';
        }
      }
    }
    return u.toString();
  } catch {
    return raw;
  }
}

/**
 * Token: giống CLI — endpoint (thường wss) → authenticate(token) → use(ns, db).
 * Gói authentication trong connect() đôi khi lệch thứ tự với Cloud.
 */
export async function connectSurreal(
  db: Surreal,
  cfg: SurrealDbEnv,
): Promise<void> {
  const url = normalizeSurrealUrl(trim(cfg.url));
  const namespace = trim(cfg.namespace);
  const database = trim(cfg.database);
  const username = trim(cfg.username);
  const password = trim(cfg.password);

  const token = trim(
    process.env.SURREALDB_TOKEN ?? process.env.DB_TOKEN ?? '',
  );
  if (token) {
    await db.connect(url);
    await db.authenticate(token);
    await db.use({ namespace, database });
    return;
  }

  if (envFlag('SURREAL_SKIP_AUTH', 'DB_NO_AUTH')) {
    await db.connect(url);
    await db.use({ namespace, database });
    return;
  }

  const mode = (process.env.SURREAL_AUTH_MODE ?? 'root').toLowerCase();

  await db.connect(url);

  let auth: AnyAuth;
  if (mode === 'database') {
    auth = { namespace, database, username, password };
  } else if (mode === 'namespace') {
    auth = { namespace, username, password };
  } else {
    auth = { username, password };
  }

  await db.signin(auth);
  await db.use({ namespace, database });
}
