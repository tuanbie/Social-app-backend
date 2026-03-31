// src/database/surreal.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { appSettings } from 'src/common/config/appSetting';
import { Surreal } from 'surrealdb';
import { connectSurreal } from 'src/database/surreal-connect.util';

@Injectable()
export class SurrealService implements OnModuleInit, OnModuleDestroy {
  public readonly client = new Surreal();
  private readonly logger = new Logger(SurrealService.name);

  async onModuleInit() {
    try {
      await connectSurreal(this.client, appSettings.db);
      this.logger.log('Kết nối SurrealDB thành công');
    } catch (error) {
      this.logger.error('Kết nối SurrealDB thất bại', error);
    }
  }

  async onModuleDestroy() {
    await this.client.close();
    this.logger.log('💤 SurrealDB connection closed');
  }
}
