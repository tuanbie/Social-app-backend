import { Body, Controller, Delete, Get, Param, Patch, Post as HttpPost, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PostService } from './post.service';
import { UpdatePostInput } from './dto/update-post.input';
import { Post } from './entities/post.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { PostQueryDto } from './dto/post-query.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@ApiTags('posts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get()
  @ApiOperation({ summary: 'List posts' })
  @ApiResponse({ status: 200, type: [Post] })
  findAll(@Query() query: PostQueryDto, @CurrentUser() user: JwtUserPayload): Promise<Post[]> {
    return this.postService.findFeedForUser(user.id ?? user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a post by id' })
  @ApiParam({ name: 'id', example: 'post:abc123' })
  @ApiResponse({ status: 200, type: Post })
  findOne(@Param('id') id: string): Promise<Post> {
    return this.postService.findOne(id);
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

