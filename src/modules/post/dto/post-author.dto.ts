import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PostAuthorDto {
  @ApiProperty({ example: 'user:abc123' })
  id!: string;

  @ApiPropertyOptional({ description: 'Tên hiển thị' })
  full_name?: string | null;

  @ApiPropertyOptional()
  username?: string | null;

  @ApiPropertyOptional()
  avatar?: string | null;
}
