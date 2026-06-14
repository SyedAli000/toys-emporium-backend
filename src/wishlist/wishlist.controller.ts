import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private wishlistService: WishlistService) {}

  @Get()
  get(@CurrentUser() user: JwtUser) {
    return this.wishlistService.get(user.userId);
  }

  @Post()
  add(
    @CurrentUser() user: JwtUser,
    @Body() body: { productId: string },
  ) {
    return this.wishlistService.add(user.userId, body.productId);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtUser, @Param('id') productId: string) {
    return this.wishlistService.remove(user.userId, productId);
  }
}
