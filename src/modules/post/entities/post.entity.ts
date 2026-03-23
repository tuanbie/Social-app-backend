import { ObjectType, Field, ID, GraphQLISODateTime } from '@nestjs/graphql';
import { registerEnumType } from '@nestjs/graphql';

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
  id: string;

  @Field(() => String, { nullable: true })
  content?: string | null;

  @Field(() => String, { nullable: true })
  image?: string | null;

  @Field(() => [String])
  files: string[];

  /**
   * SurrealDB record<user>
   * Lưu dưới dạng record id string, ví dụ: "user:abc123"
   */
  @Field(() => ID)
  author: string;

  @Field(() => PostStatus)
  status: PostStatus;

  @Field(() => GraphQLISODateTime)
  created_at: Date;
}
