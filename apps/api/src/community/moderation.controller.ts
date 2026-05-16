import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ModerationService } from './moderation.service';
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
  constructor(private readonly moderation: ModerationService) {}

  @Get('queue')
  queue(@CurrentUser() user: { sub: string }) {
    return this.moderation.getQueue(user.sub);
  }

  @Post('items/:id/vote')
  vote(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: CastVoteDto) {
    return this.moderation.vote(user.sub, id, dto.approve);
  }
}

