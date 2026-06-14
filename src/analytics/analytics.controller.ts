import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin', 'manager')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('dashboard')
  dashboard() {
    return this.analyticsService.dashboard();
  }

  @Get('sales')
  sales(@Query('days') days?: string) {
    return this.analyticsService.sales(Number(days) || 7);
  }

  @Get('products')
  products() {
    return this.analyticsService.products();
  }

  @Get('customers')
  customers() {
    return this.analyticsService.customers();
  }
}
