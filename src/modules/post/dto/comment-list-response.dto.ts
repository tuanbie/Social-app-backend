import { ApiProperty } from '@nestjs/swagger';
import { CommentListItemDto } from './comment-list-item.dto';

export class CommentListResponseDto {
  @ApiProperty({ type: [CommentListItemDto] })
  items!: CommentListItemDto[];

  @ApiProperty({
    description: 'Còn trang sau (tăng `page` hoặc dùng infinite scroll)',
  })
  hasMore!: boolean;
}
