import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ContributorStatsEntity } from './entities/contributor-stats.entity';
import { ModerationItemEntity } from './entities/moderation-item.entity';
import { ModerationVoteEntity } from './entities/moderation-vote.entity';
import { ParkingSpotEntity } from '../parking-spots/parking-spot.entity';
import { ParkingSpotPhotoEntity } from './entities/parking-spot-photo.entity';

function tierWeight(tier: 'pigeon' | 'hawk' | 'eagle'): number {
  if (tier === 'hawk') return 2;
  if (tier === 'eagle') return 3;
  return 1;
}

// Thresholds for resolution. Both approval AND rejection require reaching
// RESOLVE_THRESHOLD weighted points. Rejection additionally must lead approvals.
// This prevents a single low-weight vote from immediately killing a submission.
const RESOLVE_THRESHOLD = 3;

@Injectable()
export class ModerationService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(ContributorStatsEntity)
    private readonly statsRepo: Repository<ContributorStatsEntity>,
    @InjectRepository(ModerationItemEntity)
    private readonly itemsRepo: Repository<ModerationItemEntity>,
    @InjectRepository(ModerationVoteEntity)
    private readonly votesRepo: Repository<ModerationVoteEntity>,
    @InjectRepository(ParkingSpotEntity)
    private readonly spotsRepo: Repository<ParkingSpotEntity>,
    @InjectRepository(ParkingSpotPhotoEntity)
    private readonly photosRepo: Repository<ParkingSpotPhotoEntity>,
  ) {}

  async getOrCreateStats(userId: string): Promise<ContributorStatsEntity> {
    const existing = await this.statsRepo.findOne({ where: { userId } });
    if (existing) return existing;
    return this.statsRepo.save(this.statsRepo.create({ userId, tier: 'pigeon' }));
  }

  async getQueue(userId: string, limit = 20) {
    return this.itemsRepo
      .createQueryBuilder('item')
      .where('item.status = :status', { status: 'pending' })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM moderation_votes v
          WHERE v."moderationItemId" = item.id AND v."userId" = :userId
        )`,
        { userId },
      )
      // Exclude items the requesting user submitted — they cannot moderate their own.
      .andWhere('(item.submitterUserId IS NULL OR item.submitterUserId != :userId)', { userId })
      .orderBy('item.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async vote(userId: string, moderationItemId: string, approve: boolean) {
    const stats = await this.getOrCreateStats(userId);
    const weight = tierWeight(stats.tier);

    // All reads, score updates, and resolution run inside a single serializable
    // transaction with a row-level write lock on the moderation item. This
    // prevents concurrent votes from corrupting the score or double-resolving.
    const result = await this.dataSource.transaction('SERIALIZABLE', async (em) => {
      const item = await em.findOne(ModerationItemEntity, {
        where: { id: moderationItemId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!item) throw new NotFoundException('Moderation item not found');
      if (item.status !== 'pending') throw new BadRequestException('Moderation item already resolved');

      // Submitters cannot moderate their own submissions.
      if (item.submitterUserId && item.submitterUserId === userId) {
        throw new ForbiddenException('You cannot vote on your own submission');
      }

      const existingVote = await em.findOne(ModerationVoteEntity, { where: { moderationItemId, userId } });
      if (existingVote) throw new BadRequestException('You already voted on this item');

      await em.save(
        em.create(ModerationVoteEntity, {
          moderationItemId,
          userId,
          approve,
          weight,
          resolvedStatus: null,
          isCorrect: null,
        }),
      );

      const nextApproval = item.approvalScore + (approve ? weight : 0);
      const nextRejection = item.rejectionScore + (!approve ? weight : 0);

      // Resolution rules:
      //   Verified  — approval score reaches threshold.
      //   Rejected  — rejection score reaches threshold AND rejection leads approval.
      // Both sides require RESOLVE_THRESHOLD weighted points, so no single vote
      // (regardless of weight) can resolve an item in isolation from a cold start.
      let resolved: 'verified' | 'rejected' | null = null;
      if (nextApproval >= RESOLVE_THRESHOLD) {
        resolved = 'verified';
      } else if (nextRejection >= RESOLVE_THRESHOLD && nextRejection > nextApproval) {
        resolved = 'rejected';
      }

      item.approvalScore = nextApproval;
      item.rejectionScore = nextRejection;

      if (resolved) {
        item.status = resolved;
      }

      await em.save(item);
      return { item, resolved };
    });

    // Apply side-effects outside the transaction so a slow Supabase/DB delete
    // does not hold the row lock.
    if (result.resolved) {
      await this.applyResolution(result.item, result.resolved);
      await this.scoreAccuracyAndUpdateStats(result.item.id, result.resolved);
    }

    return {
      status: result.item.status,
      approvalScore: result.item.approvalScore,
      rejectionScore: result.item.rejectionScore,
    };
  }

  private async applyResolution(item: ModerationItemEntity, resolved: 'verified' | 'rejected') {
    if (item.kind === 'new_place' && item.targetParkingSpotId) {
      if (resolved === 'verified') {
        await this.spotsRepo.update(item.targetParkingSpotId, { communityVerification: 'verified' });
      } else {
        await this.photosRepo.delete({ parkingSpotId: item.targetParkingSpotId });
        await this.spotsRepo.delete(item.targetParkingSpotId);
      }
    }
  }

  private async scoreAccuracyAndUpdateStats(itemId: string, resolved: 'verified' | 'rejected') {
    const votes = await this.votesRepo.find({ where: { moderationItemId: itemId } });
    if (!votes.length) return;

    for (const v of votes) {
      v.resolvedStatus = resolved;
      v.isCorrect = v.approve === (resolved === 'verified');
    }
    await this.votesRepo.save(votes);

    const affectedUserIds = Array.from(new Set(votes.map((v) => v.userId)));
    for (const uid of affectedUserIds) {
      const s = await this.getOrCreateStats(uid);
      const total = await this.votesRepo.count({ where: { userId: uid } });
      const correct = await this.votesRepo.count({ where: { userId: uid, isCorrect: true } });
      s.moderationVotesCount = total;
      s.moderationAccuracy = total ? correct / total : null;
      await this.statsRepo.save(s);
    }
  }
}
