import { ApiPropertyOptional } from '@nestjs/swagger';
import { PostStatus } from '../entities/post.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class PostQueryDto extends PaginationDto {

  @ApiPropertyOptional({ example: 'user:abc123' })
  authorId?: string;

  @ApiPropertyOptional({ enum: PostStatus })
  status?: PostStatus;

  @ApiPropertyOptional({ example: 'hello world' })
  keyword?: string;
}

