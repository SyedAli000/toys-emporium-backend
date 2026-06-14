import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private cartService: CartService) {}

  @Get()
  getCart(@CurrentUser() user: JwtUser) {
    return this.cartService.getCart(user.userId);
  }

  @Post()
  add(
    @CurrentUser() user: JwtUser,
    @Body() body: { productId: string; quantity?: number },
  ) {
    return this.cartService.addItem(
      user.userId,
      body.productId,
      body.quantity || 1,
    );
  }

  @Put(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { quantity: number },
  ) {
    return this.cartService.updateItem(user.userId, id, body.quantity);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.cartService.removeItem(user.userId, id);
  }
}
