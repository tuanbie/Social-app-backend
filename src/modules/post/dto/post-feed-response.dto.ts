import { ApiProperty } from '@nestjs/swagger';
import { PostWithAuthorDto } from './post-with-author.dto';

export class PostFeedResponseDto {
  @ApiProperty({
    type: [PostWithAuthorDto],
    description: 'Danh sách bài; mỗi bài kèm `author` (id, full_name, username, avatar)',
  })
  items!: PostWithAuthorDto[];

  @ApiProperty({
    example: true,
    description:
      'true nếu còn bài phía sau — gọi lại GET /posts?limit=... để tải thêm (infinite scroll)',
  })
  hasMore!: boolean;
}
