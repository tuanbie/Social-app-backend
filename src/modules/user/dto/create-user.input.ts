import { Field, InputType } from '@nestjs/graphql';
import { UserStatus } from '../entities/user.entity';

@InputType()
export class CreateUserInput {
  @Field(() => String)
  username: string;

  @Field(() => String)
  full_name: string;

  @Field(() => String)
  email: string;

  @Field(() => String)
  password: string;

  @Field(() => String, { nullable: true })
  avatar?: string;

  @Field(() => String, { nullable: true })
  bio?: string;

  @Field(() => UserStatus, { nullable: true, defaultValue: UserStatus.ACTIVE })
  status?: UserStatus;
}
