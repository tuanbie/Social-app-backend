import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post as HttpPost,
  ParseIntPipe,
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
import { UserService } from './user.service';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { UserProfileQueryDto } from './dto/user-profile-query.dto';
import { UserProfileResponseDto } from './dto/user-profile.response.dto';

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'List users' })
  @ApiResponse({ status: 200, type: [User] })
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: User })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Get(':id/profile')
  @ApiOperation({ summary: 'Get user profile (basic info, published posts, friend status)' })
  @ApiParam({ name: 'id', example: 'user:abc123' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  getProfile(
    @Param('id') id: string,
    @Query() query: UserProfileQueryDto,
    @CurrentUser() viewer: JwtUserPayload,
  ) {
    return this.userService.getUserProfile(viewer.id ?? viewer.sub, id, query);
  }

  @HttpPost()
  @ApiOperation({ summary: 'Create a user' })
  @ApiBody({ type: CreateUserInput })
  @ApiResponse({ status: 201, type: User })
  create(@Body() body: CreateUserInput) {
    return this.userService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiBody({ type: UpdateUserInput })
  @ApiResponse({ status: 200, type: User })
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Omit<UpdateUserInput, 'id'>) {
    return this.userService.update(id, { ...(body as UpdateUserInput), id });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: User })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }
}

