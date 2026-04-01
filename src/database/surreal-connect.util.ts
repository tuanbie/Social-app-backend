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

/** Chỉ khi SURREAL_SKIP_AUTH=1 (thường là Surreal local không bật auth). Không dùng trên Cloud — sẽ anonymous và query bị chặn. */
function shouldSkipAuth(): boolean {
  return envFlag('SURREAL_SKIP_AUTH', 'DB_NO_AUTH');
}

/**
 * Một lần `connect(url, { namespace, database, authentication })` — tránh session ẩn danh / signin lệch bước.
 *
 * 1. SURREALDB_TOKEN / DB_TOKEN → JWT
 * 2. SURREAL_SKIP_AUTH=1 → không đăng nhập (local)
 * 3. USERNAME_DB + PASSWORD_DB → root / namespace / database (SURREAL_AUTH_MODE)
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
    await db.connect(url, {
      namespace,
      database,
      authentication: token,
    });
    return;
  }

  if (shouldSkipAuth()) {
    await db.connect(url, { namespace, database });
    return;
  }

  if (!username || !password) {
    throw new Error(
      'Thiếu USERNAME_DB/PASSWORD_DB hoặc SURREALDB_TOKEN. Surreal Cloud: Surrealist → Authentication → tạo Root user.',
    );
  }

  const mode = (process.env.SURREAL_AUTH_MODE ?? 'root').toLowerCase();

  let authentication: AnyAuth;
  if (mode === 'database') {
    authentication = { namespace, database, username, password };
  } else if (mode === 'namespace') {
    authentication = { namespace, username, password };
  } else {
    authentication = { username, password };
  }

  await db.connect(url, {
    namespace,
    database,
    authentication,
  });
}
