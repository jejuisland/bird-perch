import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ContributorStatsService } from './contributor-stats.service';

@ApiTags('contributors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me/contributor-stats')
export class ContributorStatsController {
  constructor(private readonly stats: ContributorStatsService) {}

  @Get()
  get(@CurrentUser() user: { sub: string }) {
    return this.stats.getOrCreate(user.sub);
  }
}

