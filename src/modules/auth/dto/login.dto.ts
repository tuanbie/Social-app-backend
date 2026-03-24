import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user71@example.com' })
  email: string;

  @ApiProperty({ example: '12345678' })
  password: string;
}

