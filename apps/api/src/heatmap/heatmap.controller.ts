import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { HeatmapService } from './heatmap.service';
import { CollectLocationDto } from './dto/collect-location.dto';
import { HeatmapQueryDto } from './dto/heatmap-query.dto';

@ApiTags('heatmap')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('heatmap')
export class HeatmapController {
  constructor(private readonly service: HeatmapService) {}

  @Get()
  getAggregated(@Query() query: HeatmapQueryDto) {
    return this.service.getAggregated(query);
  }

  @Post('collect')
  collect(@Body() dto: CollectLocationDto) {
    return this.service.collect(dto);
  }
}
