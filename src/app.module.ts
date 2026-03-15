// src/app.module.ts
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { SurrealModule } from './database/surreal.module';
import { PostModule } from './modules/post/post.module';
import { ConversationModule } from './modules/conversation/conversation.module';

@Module({
  imports: [
    // 1. Kết nối Database toàn cục
    SurrealModule,

    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'), // Tự động sinh file schema
      sortSchema: true,
      playground: true, // Bật giao diện test tại http://localhost:3000/graphql
      context: ({ req }) => ({ req }), // Đẩy request vào context để dùng Guard sau này
    }),

    PostModule,

    ConversationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
