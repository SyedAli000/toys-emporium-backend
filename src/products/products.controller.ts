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
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  findAll(@Query() query: Record<string, string>) {
    return this.productsService.findAll(query);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.productsService.search(q || '');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  create(@Body() body: Record<string, unknown>) {
    return this.productsService.create(body as never);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin', 'manager')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.productsService.update(id, body as never);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
