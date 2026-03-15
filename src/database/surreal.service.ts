// src/database/surreal.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { appSettings } from 'src/common/config/appSetting';
import { Surreal } from 'surrealdb';

@Injectable()
export class SurrealService implements OnModuleInit, OnModuleDestroy {
  public readonly client = new Surreal();
  private readonly logger = new Logger(SurrealService.name);

  async onModuleInit() {
    try {
      await this.client.connect(appSettings.db.url);

      await this.client.signin({
        username: appSettings.db.username,
        password: appSettings.db.password,
      });

      await this.client.use({
        namespace: appSettings.db.namespace,
        database: appSettings.db.database,
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
