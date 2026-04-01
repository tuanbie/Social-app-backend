import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'user:abc123 hoặc uuid', description: 'Người nhận (1-1)' })
  @IsString()
  receiverId!: string;

  @ApiProperty({ example: 'Xin chào' })
  @IsString()
  @MinLength(1)
  content!: string;
}
