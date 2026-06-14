import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin', 'manager')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findAll(@Query() query: Record<string, string>) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id/status')
  @Roles('admin', 'super_admin')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.usersService.updateStatus(id, body.isActive);
  }

  @Put(':id')
  @Roles('admin', 'super_admin')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.usersService.update(id, body as never);
  }
}
