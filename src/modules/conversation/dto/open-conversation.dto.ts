import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class OpenConversationDto {
  @ApiProperty({
    example: 'user:xxx hoặc uuid',
    description: 'User cần mở / lấy đoạn chat',
  })
  @IsString()
  @MinLength(3)
  peerId!: string;
}
