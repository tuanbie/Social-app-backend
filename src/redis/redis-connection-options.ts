import type { RedisClientOptions } from 'redis';

const MAX_DELAY_MS = 30_000;
/** Sau nhiều lần thử vẫn lỗi thì dừng để tránh loop vô hạn (process có thể restart). */
const MAX_RECONNECT_ATTEMPTS = 120;

/**
 * Tùy chọn socket dùng chung: timeout + tự kết nối lại khi mất mạng / Redis restart.
 * @see https://github.com/redis/node-redis/blob/master/docs/client-configuration.md
 */
export function createRedisClientOptions(url: string): RedisClientOptions {
  return {
    url,
    socket: {
      connectTimeout: 15_000,
      reconnectStrategy: (retries: number): number | Error => {
        if (retries > MAX_RECONNECT_ATTEMPTS) {
          return new Error(
            `Redis: đã thử kết nối lại quá ${MAX_RECONNECT_ATTEMPTS} lần`,
          );
        }
        const delay = Math.min(
          100 * Math.pow(2, Math.min(retries, 12)),
          MAX_DELAY_MS,
        );
        return delay;
      },
    },
  };
}
