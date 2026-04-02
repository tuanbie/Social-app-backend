import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '../entities/user.entity';

export class UserBasicDto {
  @ApiProperty({ example: 'user:abc123' })
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  username?: string | null | undefined;

  @ApiPropertyOptional({ nullable: true })
  full_name?: string | null | undefined;

  @ApiPropertyOptional({ nullable: true })
  email?: string | null | undefined;

  @ApiPropertyOptional({ nullable: true })
  avatar?: string | null | undefined;

  @ApiPropertyOptional({ nullable: true })
  bio?: string | null | undefined;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status!: UserStatus;

  @ApiProperty({ example: '2026-03-24T15:22:36.130Z' })
  created_at!: Date;
}

