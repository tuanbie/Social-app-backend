// src/database/surreal.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Surreal } from 'surrealdb';

@Injectable()
export class SurrealService implements OnModuleInit, OnModuleDestroy {
  public readonly client = new Surreal();
  private readonly logger = new Logger(SurrealService.name);

  async onModuleInit() {
    try {
      await this.client.connect('http://127.0.0.1:8000/rpc');

      // Đăng nhập quyền root
      await this.client.signin({
        username: 'root',
        password: 'root',
      });

      // Chọn Namespace và Database
      await this.client.use({
        namespace: 'social_ns',
        database: 'social_db',
      });

      this.logger.log('🚀 Connected to SurrealDB successfully');
    } catch (error) {
      this.logger.error('❌ Failed to connect to SurrealDB', error);
    }
  }

  async onModuleDestroy() {
    await this.client.close();
    this.logger.log('💤 SurrealDB connection closed');
  }
}
