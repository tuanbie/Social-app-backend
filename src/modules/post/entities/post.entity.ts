import { ObjectType, Field, ID, GraphQLISODateTime } from '@nestjs/graphql';
import { registerEnumType } from '@nestjs/graphql';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PostStatus {
  published = 'published',
  pending = 'pending',
}

registerEnumType(PostStatus, {
  name: 'PostStatus',
});

@ObjectType()
export class Post {
  @Field(() => ID)
  @ApiProperty({ example: 'post:abc' })
  id!: string;

  @Field(() => String, { nullable: true })
  @ApiPropertyOptional()
  content?: string | null;

  @Field(() => String, { nullable: true })
  @ApiPropertyOptional()
  image?: string | null;

  @Field(() => [String])
  @ApiProperty({ type: [String] })
  files!: string[];

  /**
   * SurrealDB record<user>
   * Lưu dưới dạng record id string, ví dụ: "user:abc123"
   */
  @Field(() => ID)
  @ApiProperty({ example: 'user:abc123' })
  author!: string;

  @Field(() => PostStatus)
  @ApiProperty({ enum: PostStatus })
  status!: PostStatus;

  @Field(() => GraphQLISODateTime)
  @ApiProperty({ type: String, format: 'date-time' })
  created_at!: Date;
}
