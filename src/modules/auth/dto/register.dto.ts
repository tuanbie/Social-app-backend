import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'johndoe' })
  username: string;

  @ApiProperty({ example: 'John Doe' })
  full_name: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ minLength: 6 })
  password: string;
}

