import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConversationService } from './conversation.service';
import { SendMessageDto } from './dto/send-message.dto';
import { OpenConversationDto } from './dto/open-conversation.dto';
import { ConversationMessagesQueryDto } from './dto/conversation-messages-query.dto';
import {
  ConversationListItemEntity,
  MessageEntity,
  OpenConversationResponseEntity,
} from './entities/message.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUserPayload } from '../auth/types/jwt-user-payload.type';

@ApiTags('conversations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) { }

  private userId(u: JwtUserPayload): string {
    return (u as any).id ?? u.sub ?? '';
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách hội thoại (theo tin nhắn gần nhất)' })
  @ApiResponse({ status: 200, type: [ConversationListItemEntity] })
  list(@CurrentUser() user: JwtUserPayload): Promise<ConversationListItemEntity[]> {
    return this.conversationService.listConversations(this.userId(user));
  }

  @Post('open')
  @ApiOperation({
    summary:
      'Mở / lấy đoạn chat với user — chưa có tin thì is_new=true; đã có thì trả snapshot giống list',
  })
  @ApiBody({ type: OpenConversationDto })
  @ApiResponse({ status: 200, type: OpenConversationResponseEntity })
  open(
    @CurrentUser() user: JwtUserPayload,
    @Body() body: OpenConversationDto,
  ): Promise<OpenConversationResponseEntity> {
    return this.conversationService.openConversation(
      this.userId(user),
      body.peerId,
    );
  }

  @Get('thread/:peerId/messages')
  @ApiOperation({ summary: 'Lịch sử tin với một user' })
  @ApiParam({ name: 'peerId', description: 'user id đối phương' })
  @ApiResponse({ status: 200, type: [MessageEntity] })
  getMessages(
    @CurrentUser() user: JwtUserPayload,
    @Param('peerId') peerId: string,
    @Query() q: ConversationMessagesQueryDto,
  ): Promise<MessageEntity[]> {
    return this.conversationService.getMessagesWithPeer(
      this.userId(user),
      peerId,
      q.limit ?? 50,
    );
  }

  @Post('messages')
  @ApiOperation({ summary: 'Gửi tin nhắn' })
  @ApiResponse({ status: 201, type: MessageEntity })
  send(
    @CurrentUser() user: JwtUserPayload,
    @Body() body: SendMessageDto,
  ): Promise<MessageEntity> {
    return this.conversationService.sendMessage(this.userId(user), body);
  }

  @Post('thread/:peerId/read')
  @ApiOperation({ summary: 'Đánh dấu đã đọc toàn bộ tin từ peer' })
  @ApiParam({ name: 'peerId' })
  markRead(
    @CurrentUser() user: JwtUserPayload,
    @Param('peerId') peerId: string,
  ): Promise<{ updated: number }> {
    return this.conversationService
      .markConversationRead(this.userId(user), peerId)
      .then((updated) => ({ updated }));
  }
}
