import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUserPayload } from '../auth/types/jwt-user-payload.type';
import { NotificationService } from './notification.service';
import { NotificationListQueryDto } from './dto/notification-list-query.dto';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('unread-count')
  @ApiOperation({
    summary: 'Đếm thông báo chưa đọc của user hiện tại',
  })
  async unreadCount(@CurrentUser() user: JwtUserPayload) {
    const uid = user.id ?? user.sub;
    const count = await this.notificationService.countUnread(uid);
    return { unread_count: count };
  }

  @Get()
  @ApiOperation({
    summary: 'Danh sách thông báo (phân trang cursor, infinite scroll)',
    description:
      'Trang đầu không gửi `cursor`. Trang sau: gửi `next_cursor` từ response trước.',
  })
  async list(
    @CurrentUser() user: JwtUserPayload,
    @Query() query: NotificationListQueryDto,
  ) {
    const uid = user.id ?? user.sub;
    return await this.notificationService.listForUser(uid, query);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu một thông báo là đã đọc' })
  @ApiParam({ name: 'id', example: 'notification:abc' })
  async markRead(
    @Param('id') id: string,
    @CurrentUser() user: JwtUserPayload,
  ) {
    const uid = user.id ?? user.sub;
    return await this.notificationService.markAsRead(uid, id);
  }
}
