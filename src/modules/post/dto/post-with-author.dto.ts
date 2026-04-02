import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostStatus } from '../entities/post.entity';
import { PostAuthorDto } from './post-author.dto';

export class PostWithAuthorDto {
  @ApiProperty({ example: 'post:abc' })
  id!: string;

  @ApiPropertyOptional()
  content?: string | null;

  @ApiPropertyOptional()
  image?: string | null;

  @ApiProperty({ type: [String] })
  files!: string[];

  @ApiProperty({ type: PostAuthorDto })
  author!: PostAuthorDto;

  @ApiProperty({ example: 12, description: 'Số lượt like trên bài' })
  likes_count!: number;

  @ApiProperty({
    example: 3,
    description:
      'Số bình luận gốc trên bài (có post_id, parent = NONE — không tính reply)',
  })
  comments_count!: number;

  @ApiProperty({ enum: PostStatus })
  status!: PostStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  created_at!: Date;
}
