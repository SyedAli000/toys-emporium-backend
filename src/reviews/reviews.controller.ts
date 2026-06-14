import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: JwtUser,
    @Body() body: { productId: string; rating: number; comment: string },
  ) {
    return this.reviewsService.create(user.userId, body);
  }

  @Get('eligible/:productId')
  @UseGuards(JwtAuthGuard)
  checkEligible(
    @CurrentUser() user: JwtUser,
    @Param('productId') productId: string,
  ) {
    return this.reviewsService.canReview(user.userId, productId);
  }

  @Get('my/:productId')
  @UseGuards(JwtAuthGuard)
  findMyReview(
    @CurrentUser() user: JwtUser,
    @Param('productId') productId: string,
  ) {
    return this.reviewsService.findMyReview(user.userId, productId);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'admin', 'super_admin')
  findAllAdmin(@Query() query: Record<string, string>) {
    return this.reviewsService.findAllAdmin(query);
  }

  @Get(':productId')
  findByProduct(@Param('productId') productId: string) {
    return this.reviewsService.findByProduct(productId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() body: { rating?: number; comment?: string },
  ) {
    return this.reviewsService.update(id, user.userId, body as never);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.reviewsService.remove(id, user.userId, user.role);
  }
}
