import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Khớp bảng `message`: content, conversation, sender, created_at */
export class MessageEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sender!: string;

  @ApiProperty({ description: 'record<conversation>' })
  conversation!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  created_at!: Date;
}

export class ConversationListItemEntity {
  @ApiProperty({ description: 'record id conversation' })
  conversation_id!: string;

  @ApiProperty({ description: 'user:… của đối phương' })
  peer_id!: string;

  @ApiPropertyOptional()
  last_message?: string;

  @ApiPropertyOptional({ type: MessageEntity })
  last_message_row?: MessageEntity;

  @ApiProperty({
    description: 'Tin từ peer có created_at sau last_read_at (user_in_conv)',
  })
  unread_count!: number;

  @ApiPropertyOptional()
  updated_at?: Date;
}

export class OpenConversationResponseEntity {
  @ApiProperty({
    description: 'true nếu chưa có tin nhắn nào trong conversation',
  })
  is_new!: boolean;

  @ApiProperty()
  conversation_id!: string;

  @ApiProperty()
  peer_id!: string;

  @ApiPropertyOptional()
  last_message?: string;

  @ApiPropertyOptional({ type: MessageEntity })
  last_message_row?: MessageEntity;

  @ApiProperty()
  unread_count!: number;

  @ApiPropertyOptional()
  updated_at?: Date;
}
