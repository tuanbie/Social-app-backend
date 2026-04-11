import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createClient } from 'redis';
import { appSettings } from '../common/config/appSetting';
import { createRedisClientOptions } from './redis-connection-options';

/**
 * Client Redis dùng cho cache / đếm (GET/SET/DEL).
 * Chỉ kết nối khi `REDIS_ENABLED=true`.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: ReturnType<typeof createClient> | null = null;

  get isEnabled(): boolean {
    return appSettings.redis.enabled;
  }

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled) {
      this.logger.warn('Redis tắt (REDIS_ENABLED≠true). Bỏ qua kết nối.');
      return;
    }
    await this.connectWithStartupRetries();
  }

  private wireClientEvents(client: ReturnType<typeof createClient>): void {
    client.on('error', (err) =>
      this.logger.error(`Redis error: ${err.message}`, err.stack),
    );
    client.on('ready', () =>
      this.logger.log(
        `Redis sẵn sàng (${appSettings.redis.url.replace(/:[^:@/]+@/, ':****@')})`,
      ),
    );
  }

  /** Lần đầu Redis chưa lên hoặc mạng chập chờ — mỗi lần thử tạo client mới để tránh state lỗi. */
  private async connectWithStartupRetries(): Promise<void> {
    const max = 8;
    for (let attempt = 1; attempt <= max; attempt++) {
      await this.client?.quit().catch(() => undefined);
      this.client = null;
      const tried = createClient(createRedisClientOptions(appSettings.redis.url));
      try {
        this.wireClientEvents(tried);
        await tried.connect();
        this.client = tried;
        return;
      } catch (e) {
        await tried.quit().catch(() => undefined);
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(
          `Redis kết nối lần ${attempt}/${max} thất bại: ${msg}`,
        );
        if (attempt === max) {
          throw e;
        }
        await new Promise((r) => setTimeout(r, Math.min(500 * attempt, 5_000)));
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit().catch(() => undefined);
    }
  }

  /**
   * Client để gửi lệnh. Khi đang reconnect, node-redis xếp hàng lệnh — không dùng `isOpen`
   * để tránh coi Redis như "tắt" và bỏ qua denylist / throttle.
   */
  getClient(): ReturnType<typeof createClient> | null {
    return this.client ?? null;
  }

  private k(key: string): string {
    const p = appSettings.redis.keyPrefix;
    return p ? `${p}:${key}` : key;
  }

  async get(key: string): Promise<string | null> {
    const c = this.getClient();
    if (!c) return null;
    const v = await c.get(this.k(key));
    return v ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const c = this.getClient();
    if (!c) return;
    const redisKey = this.k(key);
    if (ttlSeconds != null && ttlSeconds > 0) {
      await c.set(redisKey, value, { EX: ttlSeconds });
    } else {
      await c.set(redisKey, value);
    }
  }

  async del(key: string): Promise<void> {
    const c = this.getClient();
    if (!c) return;
    await c.del(this.k(key));
  }

  /**
   * INCR; nếu `ttlSecondsOnFirst` và đây là lần đầu (n === 1), set EXPIRE (cửa sổ khóa / đếm).
   * Khi Redis tắt trả về 0.
   */
  async incr(key: string, ttlSecondsOnFirst?: number): Promise<number> {
    const c = this.getClient();
    if (!c) return 0;
    const redisKey = this.k(key);
    const n = await c.incr(redisKey);
    if (ttlSecondsOnFirst != null && ttlSecondsOnFirst > 0 && n === 1) {
      await c.expire(redisKey, ttlSecondsOnFirst);
    }
    return n;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }
}
