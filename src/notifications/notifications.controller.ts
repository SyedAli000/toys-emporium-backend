import {
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @Roles('manager', 'admin', 'super_admin', 'customer')
  async findAll(@CurrentUser() user: JwtUser) {
    if (user.role === 'customer') {
      const [items, unreadCount] = await Promise.all([
        this.notificationsService.findForUser(user.userId),
        this.notificationsService.countUnreadForUser(user.userId),
      ]);
      return { items, unreadCount };
    }

    const [items, unreadCount] = await Promise.all([
      this.notificationsService.findForManager(),
      this.notificationsService.countUnread(),
    ]);
    return { items, unreadCount };
  }

  @Patch('read-all')
  @Roles('manager', 'admin', 'super_admin', 'customer')
  markAllRead(@CurrentUser() user: JwtUser) {
    if (user.role === 'customer') {
      return this.notificationsService.markAllReadForUser(user.userId);
    }
    return this.notificationsService.markAllRead();
  }

  @Patch(':id/read')
  @Roles('manager', 'admin', 'super_admin', 'customer')
  markRead(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    if (user.role === 'customer') {
      return this.notificationsService.markReadForUser(id, user.userId);
    }
    return this.notificationsService.markRead(id);
  }
}
