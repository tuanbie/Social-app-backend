import { Body, Controller, Post as HttpPost, Param, UseGuards } from '@nestjs/common';
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

@ApiTags('comments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @HttpPost(':commentId/replies')
  @ApiOperation({ summary: 'Trả lời một bình luận (reply)' })
  @ApiParam({ name: 'commentId', example: 'comment:abc' })
  @ApiBody({ type: CreateCommentDto })
  @ApiResponse({ status: 201, type: CommentWithAuthorDto })
  reply(
    @Param('commentId') commentId: string,
    @Body() body: CreateCommentDto,
    @CurrentUser() user: JwtUserPayload,
  ): Promise<CommentWithAuthorDto> {
    return this.commentService.createReply(user.id ?? user.sub, commentId, body);
  }
}
