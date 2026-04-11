// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import {
  ApolloServerPluginLandingPageLocalDefault,
} from '@apollo/server/plugin/landingPage/default';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { SurrealModule } from './database/surreal.module';
import { RedisModule } from './redis/redis.module';
import { PostModule } from './modules/post/post.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { AuthModule } from './modules/auth/auth.module';
import { UploadModule } from './modules/upload/upload.module';

@Module({
  imports: [
    // 1. Kết nối Database toàn cục
    SurrealModule,
    RedisModule,

    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 200 }],
      skipIf: (ctx) => {
        try {
          const req = ctx.switchToHttp().getRequest<{ url?: string; method?: string }>();
          if (req?.method === 'OPTIONS') return true;
          const url = req?.url ?? '';
          if (url.startsWith('/socket.io')) return true;
        } catch {
          /* không phải HTTP */
        }
        return false;
      },
    }),

    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Use __dirname so production (dist/) and dev (src/) both resolve to a writable folder
      autoSchemaFile: join(__dirname, 'schema.gql'),
      sortSchema: true,
      introspection: true,
      playground: false,
      plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
      context: ({ req }) => ({ req }), // Đẩy request vào context để dùng Guard sau này
    }),

    PostModule,
    ConversationModule,
    AuthModule,
    UploadModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
