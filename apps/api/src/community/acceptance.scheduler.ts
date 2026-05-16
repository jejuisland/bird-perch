import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewEntity } from '../reviews/review.entity';
import { ParkingSpotPhotoEntity } from './entities/parking-spot-photo.entity';
import { ContributorStatsEntity } from './entities/contributor-stats.entity';

@Injectable()
export class AcceptanceScheduler {
  constructor(
    @InjectRepository(ReviewEntity)
    private readonly reviewsRepo: Repository<ReviewEntity>,
    @InjectRepository(ParkingSpotPhotoEntity)
    private readonly photosRepo: Repository<ParkingSpotPhotoEntity>,
    @InjectRepository(ContributorStatsEntity)
    private readonly statsRepo: Repository<ContributorStatsEntity>,
  ) {}

  // Runs every 15 minutes; awards acceptance after 72 hours of survival.
  @Cron('*/15 * * * *')
  async run() {
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);

    const reviewsToAccept = await this.reviewsRepo
      .createQueryBuilder('r')
      .where('r.acceptedAt IS NULL')
      .andWhere('r.hiddenAt IS NULL')
      .andWhere('r.createdAt < :cutoff', { cutoff })
      .orderBy('r.createdAt', 'ASC')
      .limit(200)
      .getMany();

    if (reviewsToAccept.length) {
      for (const r of reviewsToAccept) r.acceptedAt = new Date();
      await this.reviewsRepo.save(reviewsToAccept);
      await this.awardPointsForAcceptedReviews(reviewsToAccept.map((r) => r.userId));
    }

    const photosToAccept = await this.photosRepo
      .createQueryBuilder('p')
      .where('p.communityApprovedAt IS NULL')
      .andWhere('p.hiddenAt IS NULL')
      .andWhere('p.createdAt < :cutoff', { cutoff })
      .orderBy('p.createdAt', 'ASC')
      .limit(200)
      .getMany();

    if (photosToAccept.length) {
      for (const p of photosToAccept) p.communityApprovedAt = new Date();
      await this.photosRepo.save(photosToAccept);
      await this.awardPointsForAcceptedPhotos(photosToAccept.map((p) => p.uploadedByUserId));
    }
  }

  private async awardPointsForAcceptedReviews(userIds: string[]) {
    const unique = Array.from(new Set(userIds));
    for (const userId of unique) {
      const stats = (await this.statsRepo.findOne({ where: { userId } })) ??
        this.statsRepo.create({ userId, tier: 'pigeon' });
      stats.contributionPoints += 2;
      stats.acceptedReviewsCount += 1;
      stats.lastContributionAt = new Date();
      await this.statsRepo.save(stats);
    }
  }

  private async awardPointsForAcceptedPhotos(userIds: string[]) {
    const unique = Array.from(new Set(userIds));
    for (const userId of unique) {
      const stats = (await this.statsRepo.findOne({ where: { userId } })) ??
        this.statsRepo.create({ userId, tier: 'pigeon' });
      stats.contributionPoints += 3;
      stats.acceptedPhotosCount += 1;
      stats.lastContributionAt = new Date();
      await this.statsRepo.save(stats);
    }
  }
}

