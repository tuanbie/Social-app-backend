// src/database/surreal.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { appSettings } from 'src/common/config/appSetting';
import { Surreal } from 'surrealdb';
import { WebSocket as NodeWebSocket } from 'ws';
import { connectSurreal } from 'src/database/surreal-connect.util';

@Injectable()
export class SurrealService implements OnModuleInit, OnModuleDestroy {
  /** Node 20 không có WebSocket như browser — SDK cần gói `ws`. */
  public readonly client = new Surreal({
    websocketImpl: NodeWebSocket as unknown as typeof globalThis.WebSocket,
  });
  private readonly logger = new Logger(SurrealService.name);

  async onModuleInit() {
    try {
      await connectSurreal(this.client, appSettings.db);
      this.logger.log('Kết nối SurrealDB thành công');
    } catch (error) {
      this.logger.error('Kết nối SurrealDB thất bại', error);
      const err = error as { kind?: string; details?: { details?: { kind?: string } } };
      if (
        err?.details?.details?.kind === 'InvalidAuth' ||
        err?.kind === 'NotAllowed'
      ) {
        this.logger.error(
          'InvalidAuth: kiểm tra USERNAME_DB/PASSWORD_DB hoặc SURREALDB_TOKEN (Surreal Cloud cần tạo Root user trong Authentication).',
        );
      }
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.client.close();
    this.logger.log('💤 SurrealDB connection closed');
  }
}
