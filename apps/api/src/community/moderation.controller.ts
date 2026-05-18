import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ModerationService } from './moderation.service';
import { CommunitySubmissionsService } from './community-submissions.service';
import { IsBoolean } from 'class-validator';

class CastVoteDto {
  @IsBoolean()
  approve: boolean;
}

@ApiTags('moderation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('moderation')
export class ModerationController {
  constructor(
    private readonly moderation: ModerationService,
    private readonly submissions: CommunitySubmissionsService,
  ) {}

  @Get('queue')
  queue(
    @CurrentUser() user: { sub: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.moderation.getQueue(
      user.sub,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 5,
    );
  }

  // Returns all moderation items the authenticated user has submitted,
  // including their current status so users can track their submissions.
  @Get('my-submissions')
  mySubmissions(@CurrentUser() user: { sub: string }) {
    return this.submissions.getMySubmissions(user.sub);
  }

  // 30 votes per minute — prevent automated vote-flooding.
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Post('items/:id/vote')
  vote(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: CastVoteDto) {
    return this.moderation.vote(user.sub, id, dto.approve);
  }
}
