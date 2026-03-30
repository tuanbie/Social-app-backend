import { InputType, Field, ID } from '@nestjs/graphql';
import { PostStatus } from '../entities/post.entity';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

@InputType()
export class CreatePostInput {
  @ApiPropertyOptional({ example: 'This is a post content' })
  @Field(() => String, { nullable: true })
  content?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  image?: string | null;

  @ApiPropertyOptional({ example: ['https://example.com/file1.pdf', 'https://example.com/file2.pdf'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Field(() => [String], { nullable: true })
  files?: string[];

  @ApiPropertyOptional({ example: 'user:abc123' })
  @IsOptional()
  @IsString()
  @Field(() => ID, {
    description: 'SurrealDB record id của user, ví dụ "user:abc123"',
  })
  authorId: string;

  @ApiPropertyOptional({ enum: PostStatus, default: PostStatus.published })
  @IsOptional()
  @IsEnum(PostStatus)
  @Field(() => PostStatus, { nullable: true, defaultValue: PostStatus.published })
  status?: PostStatus;
}
