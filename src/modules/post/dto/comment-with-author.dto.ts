import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostAuthorDto } from './post-author.dto';

export class CommentWithAuthorDto {
  @ApiProperty({ example: 'comment:abc' })
  id!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ example: 'post:xyz' })
  post_id!: string;

  /** `null` nếu bình luận gốc trên post; `comment:...` nếu là reply */
  @ApiPropertyOptional({ example: 'comment:parent', nullable: true })
  parent!: string | null;

  @ApiProperty({ type: PostAuthorDto })
  author!: PostAuthorDto;

  @ApiProperty({ type: String, format: 'date-time' })
  created_at!: Date;
}
