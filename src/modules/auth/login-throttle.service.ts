import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { appSettings } from '../../common/config/appSetting';

/**
 * Giới hạn đăng nhập sai theo email (Redis INCR + TTL).
 * Không bật khi Redis tắt.
 */
@Injectable()
export class LoginThrottleService {
  constructor(private readonly redis: RedisService) {}

  private keyEmail(email: string): string {
    return `auth:login_fail:${email.trim().toLowerCase()}`;
  }

  async assertNotLockedAsync(email: string): Promise<void> {
    if (!this.redis.isEnabled) return;
    const raw = await this.redis.get(this.keyEmail(email));
    const count = raw ? parseInt(raw, 10) : 0;
    const max = appSettings.auth.loginMaxAttempts;
    if (count >= max) {
      throw new HttpException(
        `Đăng nhập sai quá nhiều lần. Thử lại sau ${Math.ceil(appSettings.auth.loginLockWindowSec / 60)} phút.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordFailedAttempt(email: string): Promise<void> {
    if (!this.redis.isEnabled) return;
    await this.redis.incr(
      this.keyEmail(email),
      appSettings.auth.loginLockWindowSec,
    );
  }

  async clearFailedAttempts(email: string): Promise<void> {
    if (!this.redis.isEnabled) return;
    await this.redis.del(this.keyEmail(email));
  }
}
