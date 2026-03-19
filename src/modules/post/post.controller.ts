import { Body, Controller, Delete, Get, Param, Patch, Post as HttpPost } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PostService } from './post.service';
import { CreatePostInput } from './dto/create-post.input';
import { UpdatePostInput } from './dto/update-post.input';
import { Post } from './entities/post.entity';

@ApiTags('posts')
@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get()
  @ApiOperation({ summary: 'List posts' })
  @ApiResponse({ status: 200, type: [Post] })
  findAll(): Promise<Post[]> {
    return this.postService.findAll();
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
  @ApiBody({ type: CreatePostInput })
  @ApiResponse({ status: 201, type: Post })
  create(@Body() body: CreatePostInput): Promise<Post> {
    return this.postService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a post' })
  @ApiParam({ name: 'id', example: 'post:abc123' })
  @ApiBody({ type: UpdatePostInput })
  @ApiResponse({ status: 200, type: Post })
  update(@Param('id') id: string, @Body() body: Omit<UpdatePostInput, 'id'>): Promise<Post> {
    return this.postService.update(id, { ...(body as UpdatePostInput), id });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a post' })
  @ApiParam({ name: 'id', example: 'post:abc123' })
  @ApiResponse({ status: 200, type: Post })
  remove(@Param('id') id: string): Promise<Post> {
    return this.postService.remove(id);
  }
}

