import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [AuthModule],
  controllers: [ConversationController],
  providers: [ConversationService, ChatGateway],
  exports: [ChatGateway],
})
export class ConversationModule { }
