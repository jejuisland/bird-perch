import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  // 5 report submissions per minute — additional enforcement on top of the
  // daily limit handled in ReportsService.
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post()
  create(@CurrentUser() user: { sub: string }, @Body() dto: CreateReportDto) {
    return this.reports.create(user.sub, dto);
  }
}
