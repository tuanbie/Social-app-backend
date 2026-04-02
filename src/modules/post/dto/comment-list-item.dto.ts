import { ApiProperty } from '@nestjs/swagger';
import { CommentWithAuthorDto } from './comment-with-author.dto';

export class CommentListItemDto extends CommentWithAuthorDto {
  @ApiProperty({
    description: 'Số reply trực tiếp gắn với comment này (parent = comment id)',
    example: 2,
  })
  replies_count!: number;
}
