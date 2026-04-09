import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Thông tin user đối phương trong conversation (id, tên hiển thị, avatar). */
export class ConversationPeerUserDto {
  @ApiProperty({ example: 'user:abc123' })
  id!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Tên hiển thị (trường full_name trên user)',
  })
  name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatar!: string | null;
}
