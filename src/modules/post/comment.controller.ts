import {
  Body,
  Controller,
  Get,
  Param,
  Post as HttpPost,
  Query,
  UseGuards,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentWithAuthorDto } from './dto/comment-with-author.dto';
import { CommentListQueryDto } from './dto/comment-list-query.dto';
import { CommentListResponseDto } from './dto/comment-list-response.dto';

@ApiTags('comments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get(':commentId/replies')
  @ApiOperation({
    summary: 'Danh sách reply của một bình luận (phân trang)',
    description:
      'Các reply có `parent` = comment này. Mỗi dòng có `replies_count` (reply lồng nhau). `page`, `limit`.',
  })
  @ApiParam({ name: 'commentId', example: 'comment:abc' })
  @ApiResponse({ status: 200, type: CommentListResponseDto })
  listReplies(
    @Param('commentId') commentId: string,
    @Query() query: CommentListQueryDto,
  ){
    return this.commentService.listRepliesForComment(commentId, query);
  }

  @Post(':commentId/replies')
  @ApiOperation({ summary: 'Trả lời một bình luận (reply)' })
  @ApiParam({ name: 'commentId', example: 'comment:abc' })
  @ApiBody({ type: CreateCommentDto })
  @ApiResponse({ status: 201, type: CommentWithAuthorDto })
  reply(
    @Param('commentId') commentId: string,
    @Body() body: CreateCommentDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.commentService.createReply(user.id ?? user.sub, commentId, body);
  }
}
