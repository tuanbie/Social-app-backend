import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Hay quá!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  content!: string;
}
