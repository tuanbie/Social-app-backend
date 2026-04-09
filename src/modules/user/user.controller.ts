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
  ApiOkResponse,
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
import { MutualFriendPreviewDto } from './dto/mutual-friend-preview.dto';

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
  @ApiOperation({
    summary: 'Lời mời kết bạn đang chờ (do bạn gửi — đối phương chưa trả lời)',
    description:
      'Bảng `friend`: `status=pending` và `in` = current user (người gửi). Xem lời mời **đã nhận**: `GET /users/friends/incoming`.',
  })
  async getPendingFriends(
    @CurrentUser() viewer: JwtUserPayload,
  ) {
    return await this.userService.listPendingFriends(viewer.id ?? viewer.sub);
  }

  @Get('friends/incoming')
  @ApiOperation({
    summary: 'Lời mời kết bạn đã nhận, đang chờ',
    description:
      '`status=pending` và `out` = current user (bạn là người nhận; `in_user` là người gửi lời mời). Cùng format `in_user` / `out_user` như các API friend khác.',
  })
  async getIncomingFriendRequests(@CurrentUser() viewer: JwtUserPayload) {
    return await this.userService.listIncomingPendingFriends(viewer.id ?? viewer.sub);
  }

  @Get('friends')
  @ApiOperation({
    summary: 'Danh sách bạn bè (accepted)',
    description:
      'Cạnh `friend` có `status=accepted` và liên quan tới current user. Kèm `in_user` / `out_user`.',
  })
  async getFriends(@CurrentUser() viewer: JwtUserPayload) {
    return await this.userService.listFriends(viewer.id ?? viewer.sub);
  }

  @Get('blocks')
  @ApiOperation({
    summary: 'Danh sách user bạn đã chặn',
    description:
      'Bảng `block`: các cạnh có `in` = current user. Mỗi phần tử có `in_user`, `out_user` (id, full_name, username, avatar).',
  })
  async getBlocked(@CurrentUser() viewer: JwtUserPayload) {
    return await this.userService.listBlocked(viewer.id ?? viewer.sub);
  }

  @Get(':id/mutual-friends')
  @ApiOperation({
    summary: 'Danh sách bạn chung với một user',
    description:
      'Bạn chung = user thứ ba mà **cả bạn (JWT) và user `:id`** đều có cạnh `friend` với `status = accepted`. ' +
      'Không tính quan hệ `pending`. Mỗi phần tử có `id`, `full_name` (tên), `username`, `avatar`.',
  })
  @ApiOkResponse({ type: [MutualFriendPreviewDto] })
  @ApiParam({ name: 'id', example: 'user:abc123', description: 'User để so khớp bạn chung' })
  async getMutualFriends(
    @Param('id') id: string,
    @CurrentUser() viewer: JwtUserPayload,
  ) {
    return await this.userService.listMutualFriends(viewer.id ?? viewer.sub, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiParam({ name: 'id', example: 'user:abc123' })
  async findOne(@Param('id') id: string) {
    return await this.userService.findOne(id);
  }

  @Get(':id/profile')
  @ApiOperation({
    summary: 'Get user profile (basic info, published posts, friend status)',
    description:
      'Mỗi bài trong `posts` có `likes_count` và `comments_count` giống feed. ' +
      '`friend`: quan hệ `friend` + cờ `blocked_by_me` / `blocked_by_them` (bảng `block`).',
  })
  @ApiParam({ name: 'id', example: 'user:abc123' })
  async getProfile(
    @Param('id') id: string,
    @Query() query: UserProfileQueryDto,
    @CurrentUser() viewer: JwtUserPayload,
  ) {
    return await this.userService.getUserProfile(viewer.id ?? viewer.sub, id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a user' })
  @ApiBody({ type: CreateUserInput })
  async create(@Body() body: CreateUserInput) {
    return await this.userService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user (own profile only)' })
  @ApiParam({ name: 'id', example: 'user:abc123' })
  @ApiBody({ type: UpdateUserInput })
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
  async remove(@Param('id') id: string, @CurrentUser() viewer: JwtUserPayload) {
    return await this.userService.remove(id, viewer.id ?? viewer.sub);
  }

  @Post(':id/friend')
  @ApiOperation({
    summary: 'Gửi / chấp nhận lời mời kết bạn',
    description:
      'Bảng `friend` (`pending` | `accepted` | `declined`). Có block giữa hai người thì không gửi được. ' +
      'Nếu đối phương đã gửi pending tới bạn → merge `accepted`. Nếu trước đó `declined` → gửi lại thành `pending`.',
  })
  @ApiParam({ name: 'id', example: 'user:abc123' })
  async addFriend(@Param('id') id: string, @CurrentUser() viewer: JwtUserPayload) {
    return await this.userService.sendFriendRequest(viewer.id ?? viewer.sub, id);
  }

  @Post(':id/unfriend')
  @ApiOperation({
    summary: 'Hủy kết bạn hoặc lời mời / từ chối (xóa cạnh friend)',
    description: 'Xóa cạnh `friend` giữa hai user (pending, accepted, declined).',
  })
  @ApiParam({ name: 'id', example: 'user:abc123' })
  async unfriend(@Param('id') id: string, @CurrentUser() viewer: JwtUserPayload) {
    return await this.userService.cancelFriend(viewer.id ?? viewer.sub, id);
  }

  @Post(':id/block')
  @ApiOperation({
    summary: 'Chặn user',
    description:
      'Tạo cạnh `block` (in=you → out=target). Xóa cạnh `friend` nếu đang có. Đã chặn rồi thì trả về bản ghi hiện có.',
  })
  @ApiParam({ name: 'id', example: 'user:abc123' })
  async block(@Param('id') id: string, @CurrentUser() viewer: JwtUserPayload) {
    return await this.userService.blockUser(viewer.id ?? viewer.sub, id);
  }

  @Post(':id/unblock')
  @ApiOperation({
    summary: 'Bỏ chặn',
    description: 'Xóa cạnh `block` do bạn chặn họ (in=you, out=target).',
  })
  @ApiParam({ name: 'id', example: 'user:abc123' })
  async unblock(@Param('id') id: string, @CurrentUser() viewer: JwtUserPayload) {
    return await this.userService.unblockUser(viewer.id ?? viewer.sub, id);
  }
}
