import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class PaginationDto {
  @ApiProperty({ example: 1 })
  @IsString()
  page?: number;

  @ApiProperty({ example: 10 })
  @IsString()
  limit?: number;
}