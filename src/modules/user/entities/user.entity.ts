import { ObjectType, Field, ID, GraphQLISODateTime, registerEnumType } from '@nestjs/graphql';

export enum UserStatus {
  active = 'active',
  blocked = 'blocked',
}

registerEnumType(UserStatus, {
  name: 'UserStatus',
});
@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field(() => String, { nullable: true })
  username?: string | null;

  @Field(() => String, { nullable: true })
  full_name?: string | null;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  avatar?: string | null;

  @Field(() => String, { nullable: true })
  bio?: string | null;

  @Field(() => UserStatus)
  status: UserStatus;

  @Field(() => GraphQLISODateTime)
  created_at: Date;
}
