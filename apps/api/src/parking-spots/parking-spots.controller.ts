import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { ParkingSpotsService } from './parking-spots.service';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { CreateParkingSpotDto } from './dto/create-parking-spot.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateCommunityParkingSpotDto } from '../community/dto/create-community-parking-spot.dto';
import { CommunitySubmissionsService } from '../community/community-submissions.service';

@ApiTags('parking-spots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('parking-spots')
export class ParkingSpotsController {
  constructor(
    private readonly service: ParkingSpotsService,
    private readonly community: CommunitySubmissionsService,
  ) {}

  @Get()
  findNearby(@Query() query: NearbyQueryDto) {
    return this.service.findNearby(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateParkingSpotDto) {
    return this.service.create(dto);
  }

  @Throttle({ default: { ttl: 600000, limit: process.env.NODE_ENV === 'development' ? 1000 : 5 } })
  @Post('community')
  createCommunity(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateCommunityParkingSpotDto,
  ) {
    return this.community.submitNewPlace(user.sub, dto);
  }
}
