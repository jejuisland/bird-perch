import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContributorStatsEntity } from './entities/contributor-stats.entity';
import { FavoriteParkingSpotEntity } from './entities/favorite-parking-spot.entity';
import { ModerationItemEntity } from './entities/moderation-item.entity';
import { ModerationVoteEntity } from './entities/moderation-vote.entity';
import { ParkingSpotPhotoEntity } from './entities/parking-spot-photo.entity';
import { ReportEntity } from './entities/report.entity';
import { ReviewHelpfulVoteEntity } from './entities/review-helpful-vote.entity';
import { CommunitySubmissionsService } from './community-submissions.service';
import { RateSummaryService } from './rate-summary.service';
import { ParkingSpotEntity } from '../parking-spots/parking-spot.entity';
import { UploadsModule } from '../uploads/uploads.module';
import { ModerationService } from './moderation.service';
import { ModerationController } from './moderation.controller';
import { AcceptanceScheduler } from './acceptance.scheduler';
import { ReviewEntity } from '../reviews/review.entity';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';
import { ContributorStatsService } from './contributor-stats.service';
import { ContributorStatsController } from './contributor-stats.controller';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContributorStatsEntity,
      FavoriteParkingSpotEntity,
      ModerationItemEntity,
      ModerationVoteEntity,
      ParkingSpotPhotoEntity,
      ReportEntity,
      ReviewHelpfulVoteEntity,
      ParkingSpotEntity,
      ReviewEntity,
    ]),
    UploadsModule,
  ],
  providers: [
    CommunitySubmissionsService,
    RateSummaryService,
    ModerationService,
    AcceptanceScheduler,
    FavoritesService,
    ContributorStatsService,
    ReportsService,
  ],
  controllers: [
    ModerationController,
    FavoritesController,
    ContributorStatsController,
    ReportsController,
  ],
  exports: [TypeOrmModule, CommunitySubmissionsService],
})
export class CommunityModule {}
