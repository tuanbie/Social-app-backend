import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { PostStatus } from '../entities/post.entity';

@InputType()
export class PostQueryInput {
  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 10 })
  limit?: number;

  @Field(() => ID, { nullable: true })
  authorId?: string;

  @Field(() => PostStatus, { nullable: true })
  status?: PostStatus;

  @Field(() => String, { nullable: true })
  keyword?: string;
}

