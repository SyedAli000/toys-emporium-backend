import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  create(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      shippingAddress: Record<string, string>;
      notes?: string;
    },
  ) {
    return this.ordersService.create(user.userId, body as never);
  }

  @Get()
  findMine(@CurrentUser() user: JwtUser) {
    return this.ordersService.findByUser(user.userId);
  }

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles('manager', 'admin', 'super_admin')
  findAllAdmin(@Query() query: Record<string, string>) {
    return this.ordersService.findAllAdmin(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.ordersService.findOne(id, user);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('manager', 'admin', 'super_admin')
  update(
    @Param('id') id: string,
    @Body() body: { status?: string; trackingNumber?: string },
  ) {
    return this.ordersService.updateStatus(id, body);
  }
}
