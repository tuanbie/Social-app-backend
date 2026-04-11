import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { ConversationModule } from '../conversation/conversation.module';

@Module({
  imports: [AuthModule, ConversationModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
