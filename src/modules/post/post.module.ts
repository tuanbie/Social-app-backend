import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PostService } from './post.service';
import { PostResolver } from './post.resolver';
import { PostController } from './post.controller';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';

@Module({
  imports: [AuthModule],
  controllers: [PostController, CommentController],
  providers: [PostResolver, PostService, CommentService],
  exports: [PostService],
})
export class PostModule {}
