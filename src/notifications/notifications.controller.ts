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

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager', 'admin', 'super_admin')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  async findAll() {
    const [items, unreadCount] = await Promise.all([
      this.notificationsService.findForManager(),
      this.notificationsService.countUnread(),
    ]);
    return { items, unreadCount };
  }

  @Patch('read-all')
  markAllRead() {
    return this.notificationsService.markAllRead();
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }
}
