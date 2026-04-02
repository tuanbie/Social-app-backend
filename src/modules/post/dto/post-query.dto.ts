import { ApiPropertyOptional } from '@nestjs/swagger';
import { PostStatus } from '../entities/post.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class PostQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'user:abc123' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({ enum: PostStatus })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  keyword?: string;
}

