import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserResolver } from './user.resolver';
import { UserController } from './user.controller';
import { PostModule } from '../post/post.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PostModule, NotificationModule],
  controllers: [UserController],
  providers: [UserResolver, UserService],
})
export class UserModule {}
