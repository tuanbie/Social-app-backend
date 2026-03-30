import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type FriendStatus = 'pending' | 'accepted' | 'blocked';

export class UserFriendStatusDto {
  @ApiProperty({ example: false })
  is_friend: boolean;

  @ApiPropertyOptional({ nullable: true, enum: ['pending', 'accepted', 'blocked'] })
  status?: FriendStatus | null;
}

