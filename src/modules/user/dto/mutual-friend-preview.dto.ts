import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Một user trong danh sách bạn chung (đủ id, tên, avatar cho client). */
export class MutualFriendPreviewDto {
  @ApiProperty({ example: 'user:abc123' })
  id!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Tên hiển thị (trường full_name trên user)',
  })
  full_name!: string | null;

  @ApiPropertyOptional({ nullable: true })
  username!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'URL ảnh đại diện' })
  avatar!: string | null;
}
