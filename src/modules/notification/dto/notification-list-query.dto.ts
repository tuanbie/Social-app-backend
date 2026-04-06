import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class NotificationListQueryDto {
  @ApiPropertyOptional({
    example: 20,
    minimum: 1,
    maximum: 100,
    description:
      'Số bản ghi mỗi trang (infinite scroll). Mặc định 20, tối đa 100.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Cursor trang sau: giá trị `next_cursor` từ response trước (opaque string).',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
