import { ApiProperty } from '@nestjs/swagger';
import { UserBasicDto } from './user-basic.dto';
import { UserPostPreviewDto } from './user-post-preview.dto';
import { UserFriendStatusDto } from './user-friend-status.dto';

export class UserProfileResponseDto {
  @ApiProperty({ type: () => UserBasicDto })
  user: UserBasicDto;

  @ApiProperty({ type: () => [UserPostPreviewDto] })
  posts: UserPostPreviewDto[];

  @ApiProperty({ type: () => UserFriendStatusDto })
  friend: UserFriendStatusDto;
}

