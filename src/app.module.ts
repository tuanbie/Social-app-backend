// src/app.module.ts
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import {
  ApolloServerPluginLandingPageLocalDefault,
} from '@apollo/server/plugin/landingPage/default';
import { join } from 'path';
import { SurrealModule } from './database/surreal.module';
import { PostModule } from './modules/post/post.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    // 1. Kết nối Database toàn cục
    SurrealModule,

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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
