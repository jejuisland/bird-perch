import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewEntity } from '../reviews/review.entity';
import { ParkingSpotPhotoEntity } from './entities/parking-spot-photo.entity';
import { ContributorStatsEntity } from './entities/contributor-stats.entity';

// Contribution point values.
const POINTS_REVIEW = 2;
const POINTS_PHOTO = 3;

// Tier promotion thresholds (contribution points).
const TIER_HAWK_THRESHOLD = 50;
const TIER_EAGLE_THRESHOLD = 200;

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
      await this.awardPoints(reviewsToAccept.map((r) => r.userId), POINTS_REVIEW, 'review');
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
      await this.awardPoints(photosToAccept.map((p) => p.uploadedByUserId), POINTS_PHOTO, 'photo');
    }
  }

  // Awards points for each accepted item individually, then promotes tier if
  // the user's total crosses a threshold. userIds may contain duplicates — one
  // entry per accepted item — so we tally per-user counts first.
  private async awardPoints(userIds: string[], pointsEach: number, kind: 'review' | 'photo') {
    const tally = new Map<string, number>();
    for (const uid of userIds) tally.set(uid, (tally.get(uid) ?? 0) + 1);

    for (const [userId, count] of tally) {
      const stats =
        (await this.statsRepo.findOne({ where: { userId } })) ??
        this.statsRepo.create({ userId, tier: 'pigeon' });

      stats.contributionPoints += pointsEach * count;
      stats.lastContributionAt = new Date();

      if (kind === 'review') stats.acceptedReviewsCount += count;
      else stats.acceptedPhotosCount += count;

      // Promote tier based on cumulative points.
      if (stats.tier === 'pigeon' && stats.contributionPoints >= TIER_HAWK_THRESHOLD) {
        stats.tier = 'hawk';
      } else if (stats.tier === 'hawk' && stats.contributionPoints >= TIER_EAGLE_THRESHOLD) {
        stats.tier = 'eagle';
      }

      await this.statsRepo.save(stats);
    }
  }
}
