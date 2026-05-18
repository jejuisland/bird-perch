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

// Requires Eagle+Hawk (5), Eagle+two Pigeons (5), or five Pigeons (5) minimum.
// Prevents any single voter — including Eagle (weight=3) — from resolving alone.
const RESOLVE_THRESHOLD = 5;

// Points awarded to the spot submitter when their submission is verified.
const POINTS_SPOT_VERIFIED = 10;

// Points awarded to a voter whose vote matched the final resolution outcome.
const POINTS_CORRECT_VOTE = 1;

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

  async getQueue(userId: string, page = 1, limit = 5) {
    const offset = (page - 1) * limit;

    const qb = this.itemsRepo
      .createQueryBuilder('item')
      .where('item.status = :status', { status: 'pending' })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM moderation_votes v
          WHERE v."moderationItemId" = item.id AND v."userId" = :userId
        )`,
        { userId },
      )
      .andWhere('(item.submitterUserId IS NULL OR item.submitterUserId != :userId)', { userId })
      .orderBy('item.createdAt', 'ASC');

    const total = await qb.getCount();
    const items = await qb.skip(offset).take(limit).getMany();

    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async vote(userId: string, moderationItemId: string, approve: boolean) {
    const stats = await this.getOrCreateStats(userId);
    const weight = tierWeight(stats.tier);

    // All reads, score updates, resolution, and DB side-effects run inside a
    // single SERIALIZABLE transaction with a row-level write lock on the
    // moderation item. This prevents concurrent votes from corrupting the score
    // or double-resolving, and guarantees parking_spots is updated atomically
    // with moderation_items — no gap for a crash to leave them inconsistent.
    const result = await this.dataSource.transaction('SERIALIZABLE', async (em) => {
      const item = await em.findOne(ModerationItemEntity, {
        where: { id: moderationItemId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!item) throw new NotFoundException('Moderation item not found');
      if (item.status !== 'pending') throw new BadRequestException('Moderation item already resolved');

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

        // Apply all DB side-effects inside the transaction so a crash after
        // commit cannot leave parking_spots out of sync with moderation_items.
        if (item.kind === 'new_place' && item.targetParkingSpotId) {
          if (resolved === 'verified') {
            await em.update(ParkingSpotEntity, item.targetParkingSpotId, {
              communityVerification: 'verified',
            });

            // Award submitter on verification.
            if (item.submitterUserId) {
              const submitterStats =
                (await em.findOne(ContributorStatsEntity, { where: { userId: item.submitterUserId } })) ??
                em.create(ContributorStatsEntity, { userId: item.submitterUserId, tier: 'pigeon' });
              submitterStats.contributionPoints += POINTS_SPOT_VERIFIED;
              submitterStats.verifiedPlacesCount += 1;
              submitterStats.lastContributionAt = new Date();
              // Promote tier if thresholds crossed.
              if (submitterStats.tier === 'pigeon' && submitterStats.contributionPoints >= 50) {
                submitterStats.tier = 'hawk';
              } else if (submitterStats.tier === 'hawk' && submitterStats.contributionPoints >= 200) {
                submitterStats.tier = 'eagle';
              }
              await em.save(submitterStats);
            }
          } else {
            // Soft-delete: hide photos and mark spot. A nightly purge job can
            // hard-delete after a retention window (Phase 2).
            await em.update(
              ParkingSpotPhotoEntity,
              { parkingSpotId: item.targetParkingSpotId },
              { hiddenAt: new Date() },
            );
            // communityVerification stays 'unverified' — already filtered from
            // findNearby(), so the spot is invisible without a hard delete.
          }
        }
      }

      await em.save(item);
      return { item, resolved };
    });

    // Score voter accuracy and award correct-vote points. This runs outside the
    // transaction intentionally — it is a secondary scoring pass. A crash here
    // does not corrupt consistency; the worst outcome is a voter's accuracy
    // stats being momentarily stale until the next vote resolves.
    if (result.resolved) {
      await this.scoreAccuracyAndAwardVoterPoints(result.item.id, result.resolved);
    }

    return {
      status: result.item.status,
      approvalScore: result.item.approvalScore,
      rejectionScore: result.item.rejectionScore,
    };
  }

  private async scoreAccuracyAndAwardVoterPoints(itemId: string, resolved: 'verified' | 'rejected') {
    const votes = await this.votesRepo.find({ where: { moderationItemId: itemId } });
    if (!votes.length) return;

    for (const v of votes) {
      v.resolvedStatus = resolved;
      v.isCorrect = v.approve === (resolved === 'verified');
    }
    await this.votesRepo.save(votes);

    const affectedUserIds = Array.from(new Set(votes.map((v) => v.userId)));

    // Single aggregate query replaces N×2 COUNT queries.
    const accuracyRows: { userId: string; total: string; correct: string }[] =
      await this.votesRepo
        .createQueryBuilder('v')
        .select('v.userId', 'userId')
        .addSelect('COUNT(*)', 'total')
        .addSelect('SUM(CASE WHEN v.isCorrect = true THEN 1 ELSE 0 END)', 'correct')
        .where('v.userId IN (:...userIds)', { userIds: affectedUserIds })
        .groupBy('v.userId')
        .getRawMany();

    const accuracyMap = new Map(accuracyRows.map((r) => [r.userId, r]));

    for (const uid of affectedUserIds) {
      const s = await this.getOrCreateStats(uid);
      const row = accuracyMap.get(uid);
      if (row) {
        const total = parseInt(row.total, 10);
        const correct = parseInt(row.correct, 10);
        s.moderationVotesCount = total;
        s.moderationAccuracy = total ? correct / total : null;
      }

      // Award 1 point for voting with the majority outcome.
      const thisVote = votes.find((v) => v.userId === uid);
      if (thisVote?.isCorrect) {
        s.contributionPoints += POINTS_CORRECT_VOTE;
        s.lastContributionAt = new Date();
        if (s.tier === 'pigeon' && s.contributionPoints >= 50) s.tier = 'hawk';
        else if (s.tier === 'hawk' && s.contributionPoints >= 200) s.tier = 'eagle';
      }

      await this.statsRepo.save(s);
    }
  }
}
