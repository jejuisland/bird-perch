import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

@ApiTags('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('parking-spots/:spotId/reviews')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @Get()
  findAll(@Param('spotId') spotId: string) {
    return this.service.findBySpot(spotId);
  }

  @Post()
  create(
    @Param('spotId') spotId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateReviewDto,
  ) {
    return this.service.create(user.sub, spotId, dto);
  }
}
