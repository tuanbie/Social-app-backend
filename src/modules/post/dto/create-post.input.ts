import { InputType, Field, ID } from '@nestjs/graphql';
import { PostStatus } from '../entities/post.entity';

@InputType()
export class CreatePostInput {
  @Field(() => String, { nullable: true })
  content?: string | null;

  @Field(() => String, { nullable: true })
  image?: string | null;

  @Field(() => [String], { nullable: true })
  files?: string[];

  @Field(() => ID, {
    description: 'SurrealDB record id của user, ví dụ "user:abc123"',
  })
  authorId: string;

  @Field(() => PostStatus, { nullable: true, defaultValue: PostStatus.published })
  status?: PostStatus;
}
