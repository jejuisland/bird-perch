import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdsService } from './ads.service';
import { AdEntity } from './ad.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  /** Public — mobile app polls this to get the current rotation */
  @Get('active')
  findActive() {
    return this.adsService.findActive();
  }

  /** Admin — see all ads (active + inactive) */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
  findAll() {
    return this.adsService.findAll();
  }

  /** Admin — create a new ad */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  create(@Body() body: Partial<AdEntity>) {
    return this.adsService.create(body);
  }

  /**
   * Admin — update an ad (toggle isActive, change duration, swap image URL, etc.)
   *
   * Example — disable an ad:
   *   PATCH /ads/:id   { "isActive": false }
   *
   * Example — change display duration:
   *   PATCH /ads/:id   { "durationSeconds": 15 }
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<AdEntity>) {
    return this.adsService.update(id, body);
  }

  /** Admin — permanently delete an ad */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adsService.remove(id);
  }
}
