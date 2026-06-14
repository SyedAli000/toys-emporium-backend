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
import { BannersService } from './banners.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('banners')
export class BannersController {
  constructor(private bannersService: BannersService) {}

  @Get()
  findAll(@Query('activeOnly') activeOnly?: string) {
    return this.bannersService.findAll(activeOnly === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bannersService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  create(@Body() body: Record<string, unknown>) {
    return this.bannersService.create(body as never);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.bannersService.update(id, body as never);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  remove(@Param('id') id: string) {
    return this.bannersService.remove(id);
  }
}
