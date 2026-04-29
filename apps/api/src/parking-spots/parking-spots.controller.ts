import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ParkingSpotsService } from './parking-spots.service';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { CreateParkingSpotDto } from './dto/create-parking-spot.dto';

@ApiTags('parking-spots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('parking-spots')
export class ParkingSpotsController {
  constructor(private readonly service: ParkingSpotsService) {}

  @Get()
  findNearby(@Query() query: NearbyQueryDto) {
    return this.service.findNearby(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  create(@Body() dto: CreateParkingSpotDto) {
    return this.service.create(dto);
  }
}
