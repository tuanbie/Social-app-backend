import { ApiProperty } from '@nestjs/swagger';

export class LikeResponseDto {
  @ApiProperty({
    description:
      'Trạng thái sau khi xử lý: true = user đang like bài, false = không còn like',
  })
  liked!: boolean;
}
