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
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post('guest')
  createGuest(
    @Body()
    body: {
      items: { productId: string; quantity: number }[];
      shippingAddress: Record<string, string>;
      notes?: string;
      paymentMethod?: string;
    },
  ) {
    return this.ordersService.createGuest(body as never);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: JwtUser) {
    return this.ordersService.findByUser(user.userId);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'super_admin')
  findAllAdmin(@Query() query: Record<string, string>) {
    return this.ordersService.findAllAdmin(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.ordersService.findOne(id, user);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'super_admin')
  update(
    @Param('id') id: string,
    @Body() body: { status?: string; trackingNumber?: string },
  ) {
    return this.ordersService.updateStatus(id, body);
  }
}
