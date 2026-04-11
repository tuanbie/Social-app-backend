import { IoAdapter } from '@nestjs/platform-socket.io';
import { Logger } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import type { Server } from 'socket.io';
import type { INestApplication } from '@nestjs/common';
import { createRedisClientOptions } from './redis-connection-options';

/**
 * Socket.IO + Redis: broadcast giữa nhiều instance (cùng REDIS_URL).
 * Pub/sub tách khỏi RedisService (ứng dụng). Dùng chung cấu hình reconnect với RedisService.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private pubClient!: ReturnType<typeof createClient>;
  private subClient!: ReturnType<typeof createClient>;

  constructor(
    private readonly app: INestApplication,
    private readonly redisUrl: string,
  ) {
    super(app);
  }

  async connect(): Promise<void> {
    const max = 8;
    for (let attempt = 1; attempt <= max; attempt++) {
      await this.safeQuitClients();
      try {
        this.pubClient = createClient(createRedisClientOptions(this.redisUrl));
        this.subClient = this.pubClient.duplicate();
        const onErr = (label: string) => (err: Error) =>
          this.logger.error(`Redis ${label} (Socket.IO adapter): ${err.message}`);
        this.pubClient.on('error', onErr('pub'));
        this.subClient.on('error', onErr('sub'));
        this.pubClient.on('ready', () =>
          this.logger.log('Redis pub client sẵn sàng (Socket.IO)'),
        );
        await Promise.all([
          this.pubClient.connect(),
          this.subClient.connect(),
        ]);
        return;
      } catch (e) {
        await this.safeQuitClients();
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(
          `Redis Socket.IO kết nối lần ${attempt}/${max} thất bại: ${msg}`,
        );
        if (attempt === max) {
          throw e;
        }
        await new Promise((r) => setTimeout(r, Math.min(500 * attempt, 5_000)));
      }
    }
  }

  private async safeQuitClients(): Promise<void> {
    await Promise.all([
      this.pubClient?.quit().catch(() => undefined),
      this.subClient?.quit().catch(() => undefined),
    ]);
  }

  async disconnect(): Promise<void> {
    await this.safeQuitClients();
  }

  createIOServer(port: number, options?: Record<string, unknown>): Server {
    const server: Server = super.createIOServer(port, options);
    server.adapter(createAdapter(this.pubClient, this.subClient));
    return server;
  }
}
