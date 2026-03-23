import { CreatePostInput } from './create-post.input';
import { InputType, Field, ID, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdatePostInput extends PartialType(CreatePostInput) {
  @Field(() => ID, { description: 'SurrealDB record id, ví dụ "post:abc123"' })
  id: string;
}
