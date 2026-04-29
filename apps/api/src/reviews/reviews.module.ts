import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewEntity } from './review.entity';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { ParkingSpotsModule } from '../parking-spots/parking-spots.module';

@Module({
  imports: [TypeOrmModule.forFeature([ReviewEntity]), ParkingSpotsModule],
  providers: [ReviewsService],
  controllers: [ReviewsController],
})
export class ReviewsModule {}
