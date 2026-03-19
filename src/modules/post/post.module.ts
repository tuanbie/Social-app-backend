import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostResolver } from './post.resolver';
import { PostController } from './post.controller';

@Module({
  controllers: [PostController],
  providers: [PostResolver, PostService],
})
export class PostModule {}
