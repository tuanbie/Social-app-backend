// src/database/surreal.module.ts
import { Global, Module } from '@nestjs/common';
import { SurrealService } from './surreal.service';
import { UserModule } from '../modules/user/user.module';

@Global()
@Module({
  providers: [SurrealService],
  exports: [SurrealService],
  imports: [UserModule],
})
export class SurrealModule {}
