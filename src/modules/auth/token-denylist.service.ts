import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

/**
 * Lưu jti đã logout vào Redis — access JWT còn hạn nhưng bị từ chối.
 * Khi Redis tắt, logout chỉ phía client (không revoke server-side).
 */
@Injectable()
export class TokenDenylistService {
  constructor(private readonly redis: RedisService) {}

  get isEnabled(): boolean {
    return this.redis.isEnabled;
  }

  async revokeUntilExpiry(jti: string, expUnixSec: number): Promise<void> {
    if (!this.redis.isEnabled) return;
    const now = Math.floor(Date.now() / 1000);
    const ttl = expUnixSec - now;
    if (ttl <= 0) return;
    await this.redis.set(`auth:deny:${jti}`, '1', ttl);
  }

  async isRevoked(jti: string): Promise<boolean> {
    if (!this.redis.isEnabled) return false;
    const v = await this.redis.get(`auth:deny:${jti}`);
    return v != null;
  }
}
