import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetLikeDto {
  @ApiProperty({
    description: 'true = thêm like, false = bỏ like',
    example: true,
  })
  @IsBoolean()
  status!: boolean;
}
