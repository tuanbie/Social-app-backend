import { PaginationDto } from '../../../common/dto/pagination.dto';

/** Query phân trang cho danh sách comment / reply */
export class CommentListQueryDto extends PaginationDto {
  declare page?: number;
  declare limit?: number;
}
