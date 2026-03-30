import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostStatus } from '../../post/entities/post.entity';

export class UserPostPreviewDto {
  @ApiProperty({ example: 'post:abc123' })
  id: string;

  @ApiPropertyOptional({ nullable: true })
  content?: string | null;

  @ApiPropertyOptional({ nullable: true })
  image?: string | null;

  @ApiPropertyOptional({ type: [String] })
  files?: string[];

  @ApiProperty({ example: 'user:abc123' })
  author: string;

  @ApiProperty({ enum: PostStatus, example: PostStatus.published })
  status: PostStatus;

  @ApiProperty({ example: '2026-03-24T15:22:36.130Z' })
  created_at: Date;
}

