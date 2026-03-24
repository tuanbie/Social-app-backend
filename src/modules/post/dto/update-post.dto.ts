import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { PostStatus } from '../entities/post.entity';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  content?: string | null;

  @IsOptional()
  @IsString()
  image?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  files?: string[];

  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}

