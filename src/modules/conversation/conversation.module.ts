import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { ChatGateway } from './chat.gateway';
import { appSettings } from '../../common/config/appSetting';

@Module({
  imports: [
    JwtModule.register({
      secret: appSettings.jwt.secret as string,
      signOptions: {
        expiresIn: (appSettings.jwt.expiresIn as any) || '7d',
      },
    }),
  ],
  controllers: [ConversationController],
  providers: [ConversationService, ChatGateway],
})
export class ConversationModule { }
