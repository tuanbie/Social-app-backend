import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
  constructor(private readonly userService: UserService) { }

  @Get()
  @ApiOperation({ summary: 'List users' })
  @ApiResponse({ status: 200, type: [User] })
  async findAll() {
    return await this.userService.findAll();
  }

  /** Static paths before @Get(':id') so "friends" / "blocks" are not captured as ids. */
  @Get('friends/pending')
  @ApiOperation({ summary: 'List pending friend requests sent by current user' })
  async getPendingFriends(@CurrentUser() viewer: JwtUserPayload) {
    return await this.userService.listPendingFriends(viewer.id ?? viewer.sub);
  }

  @Get('friends')
  @ApiOperation({ summary: 'List accepted friends of current user' })
  async getFriends(@CurrentUser() viewer: JwtUserPayload) {
    return await this.userService.listFriends(viewer.id ?? viewer.sub);
  }

  @Get('blocks')
  @ApiOperation({ summary: 'List blocked users' })
  async getBlocked(@CurrentUser() viewer: JwtUserPayload) {
    return await this.userService.listBlocked(viewer.id ?? viewer.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiParam({ name: 'id', example: 'user:abc123' })
  @ApiResponse({ status: 200, type: User })
  async findOne(@Param('id') id: string) {
    return await this.userService.findOne(id);
  }

  @Get(':id/profile')
  @ApiOperation({ summary: 'Get user profile (basic info, published posts, friend status)' })
  @ApiParam({ name: 'id', example: 'user:abc123' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  async getProfile(
    @Param('id') id: string,
    @Query() query: UserProfileQueryDto,
    @CurrentUser() viewer: JwtUserPayload,
  ): Promise<UserProfileResponseDto> {
    return await this.userService.getUserProfile(viewer.id ?? viewer.sub, id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a user' })
  @ApiBody({ type: CreateUserInput })
  @ApiResponse({ status: 201, type: User })
  async create(@Body() body: CreateUserInput): Promise<User> {
    return await this.userService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user (own profile only)' })
  @ApiParam({ name: 'id', example: 'user:abc123' })
  @ApiBody({ type: UpdateUserInput })
  @ApiResponse({ status: 200, type: User })
  async update(
    @Param('id') id: string,
    @Body() body: Omit<UpdateUserInput, 'id'>,
    @CurrentUser() viewer: JwtUserPayload,
  ) {
    return await this.userService.update(
      id,
      { ...(body as UpdateUserInput), id },
      viewer.id ?? viewer.sub,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user (own account only)' })
  @ApiParam({ name: 'id', example: 'user:abc123' })
  @ApiResponse({ status: 200, type: User })
  async remove(@Param('id') id: string, @CurrentUser() viewer: JwtUserPayload) {
    return await this.userService.remove(id, viewer.id ?? viewer.sub);
  }

  @Post(':id/friend')
  @ApiOperation({ summary: 'Send or accept friend request' })
  @ApiParam({ name: 'id', example: 'user:abc123' })
  async addFriend(@Param('id') id: string, @CurrentUser() viewer: JwtUserPayload) {
    return await this.userService.sendFriendRequest(viewer.id ?? viewer.sub, id);
  }

  @Post(':id/unfriend')
  @ApiOperation({ summary: 'Cancel friendship / friend request' })
  @ApiParam({ name: 'id', example: 'user:abc123' })
  async unfriend(@Param('id') id: string, @CurrentUser() viewer: JwtUserPayload) {
    return await this.userService.cancelFriend(viewer.id ?? viewer.sub, id);
  }

  @Post(':id/block')
  @ApiOperation({ summary: 'Block a user' })
  @ApiParam({ name: 'id', example: 'user:abc123' })
  async block(@Param('id') id: string, @CurrentUser() viewer: JwtUserPayload) {
    return await this.userService.blockUser(viewer.id ?? viewer.sub, id);
  }

  @Post(':id/unblock')
  @ApiOperation({ summary: 'Unblock a user' })
  @ApiParam({ name: 'id', example: 'user:abc123' })
  async unblock(@Param('id') id: string, @CurrentUser() viewer: JwtUserPayload) {
    return await this.userService.unblockUser(viewer.id ?? viewer.sub, id);
  }
}
