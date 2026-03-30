import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '../entities/user.entity';

export class UserBasicDto {
  @ApiProperty({ example: 'user:abc123' })
  id: string;

  @ApiPropertyOptional({ nullable: true })
  username?: string | null;

  @ApiPropertyOptional({ nullable: true })
  full_name?: string | null;

  @ApiPropertyOptional({ nullable: true })
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatar?: string | null;

  @ApiPropertyOptional({ nullable: true })
  bio?: string | null;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({ example: '2026-03-24T15:22:36.130Z' })
  created_at: Date;
}

