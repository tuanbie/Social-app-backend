import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post as HttpPost,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PostService } from './post.service';
import { CommentService } from './comment.service';
import { UpdatePostInput } from './dto/update-post.input';
import { Post } from './entities/post.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { PostQueryDto } from './dto/post-query.dto';
import { PostFeedResponseDto } from './dto/post-feed-response.dto';
import { PostWithAuthorDto } from './dto/post-with-author.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentWithAuthorDto } from './dto/comment-with-author.dto';
import { LikeResponseDto } from './dto/like-response.dto';
import { SetLikeDto } from './dto/set-like.dto';

@ApiTags('posts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly commentService: CommentService,
  ) {}

  @HttpPost(':postId/like')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Like / bỏ like',
    description: 'Body: `{ "status": true }` để like, `{ "status": false }` để bỏ like.',
  })
  @ApiParam({ name: 'postId', example: 'post:abc123' })
  @ApiBody({ type: SetLikeDto })
  @ApiResponse({ status: 200, type: LikeResponseDto })
  setLike(
    @Param('postId') postId: string,
    @Body() body: SetLikeDto,
    @CurrentUser() user: JwtUserPayload,
  ): Promise<LikeResponseDto> {
    return this.postService.setLikePost(
      user.id ?? user.sub,
      postId,
      body.status,
    );
  }

  @HttpPost(':postId/comments')
  @ApiOperation({ summary: 'Bình luận trên bài viết' })
  @ApiParam({ name: 'postId', example: 'post:abc123' })
  @ApiBody({ type: CreateCommentDto })
  @ApiResponse({ status: 201, type: CommentWithAuthorDto })
  commentOnPost(
    @Param('postId') postId: string,
    @Body() body: CreateCommentDto,
    @CurrentUser() user: JwtUserPayload,
  ): Promise<CommentWithAuthorDto> {
    return this.commentService.createOnPost(user.id ?? user.sub, postId, body);
  }

  @Get()
  @ApiOperation({
    summary: 'Feed bài viết (infinite scroll)',
    description:
      'Trả về `items` + `hasMore`. Mỗi bài có `author`, `likes_count`, `comments_count` (bình luận trực tiếp vào post).',
  })
  @ApiResponse({ status: 200, type: PostFeedResponseDto })
  findAll(
    @Query() query: PostQueryDto,
    @CurrentUser() user: JwtUserPayload,
  ): Promise<PostFeedResponseDto> {
    return this.postService.findFeedForUser(user.id ?? user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết một bài (kèm author)' })
  @ApiParam({ name: 'id', example: 'post:abc123' })
  @ApiResponse({ status: 200, type: PostWithAuthorDto })
  findOne(@Param('id') id: string): Promise<PostWithAuthorDto> {
    return this.postService.findOneWithAuthor(id);
  }

  @HttpPost()
  @ApiOperation({ summary: 'Create a post' })
  create(@Body() body: CreatePostDto, @CurrentUser() user: JwtUserPayload): Promise<Post> {
    return this.postService.create({
      ...body,
      authorId: user.id ?? user.sub,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a post' })
  @ApiParam({ name: 'id', example: 'post:abc123' })
  @ApiBody({ type: UpdatePostDto })
  @ApiResponse({ status: 200, type: Post })
  update(
    @Param('id') id: string,
    @Body() body: UpdatePostDto,
    @CurrentUser() user: JwtUserPayload,
  ): Promise<Post> {
    return this.postService.update(id, { ...(body as UpdatePostInput), id }, user.id ?? user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a post' })
  @ApiParam({ name: 'id', example: 'post:abc123' })
  @ApiResponse({ status: 200, type: Post })
  remove(@Param('id') id: string, @CurrentUser() user: JwtUserPayload): Promise<Post> {
    return this.postService.remove(id, user.id ?? user.sub);
  }
}

