import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me/favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: { sub: string }) {
    return this.favorites.listFavoriteSpots(user.sub);
  }

  @Post(':spotId')
  add(@CurrentUser() user: { sub: string }, @Param('spotId') spotId: string) {
    return this.favorites.add(user.sub, spotId);
  }

  @Delete(':spotId')
  remove(@CurrentUser() user: { sub: string }, @Param('spotId') spotId: string) {
    return this.favorites.remove(user.sub, spotId);
  }
}

