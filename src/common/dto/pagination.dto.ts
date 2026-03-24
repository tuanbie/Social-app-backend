import { ApiProperty } from "@nestjs/swagger";

export class PaginationDto {
  @ApiProperty({ example: 1 })
  page?: number;

  @ApiProperty({ example: 10 })
  limit?: number;
}