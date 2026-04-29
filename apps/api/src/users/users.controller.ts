import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: { sub: string }) {
    const { passwordHash, ...result } = await this.usersService.findById(user.sub);
    return result;
  }

  @Put('me')
  async updateMe(@CurrentUser() user: { sub: string }, @Body() dto: UpdateUserDto) {
    const { passwordHash, ...result } = await this.usersService.update(user.sub, dto);
    return result;
  }
}
