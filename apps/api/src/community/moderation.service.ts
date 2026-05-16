import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class ModerationService {
  constructor(
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
      .orderBy('item.createdAt', 'DESC')
      .limit(limit);

    return qb.getMany();
  }

  async vote(userId: string, moderationItemId: string, approve: boolean) {
    const stats = await this.getOrCreateStats(userId);
    const weight = tierWeight(stats.tier);

    const item = await this.itemsRepo.findOne({ where: { id: moderationItemId } });
    if (!item) throw new NotFoundException('Moderation item not found');
    if (item.status !== 'pending') throw new BadRequestException('Moderation item already resolved');

    const existingVote = await this.votesRepo.findOne({ where: { moderationItemId, userId } });
    if (existingVote) throw new BadRequestException('You already voted on this item');

    await this.votesRepo.save(
      this.votesRepo.create({
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
    if (nextApproval >= 3) resolved = 'verified';
    if (resolved === null) {
      if (nextRejection >= nextApproval) resolved = 'rejected';
      if (nextRejection >= 3) resolved = 'rejected';
    }

    item.approvalScore = nextApproval;
    item.rejectionScore = nextRejection;

    if (resolved) {
      item.status = resolved;
      await this.itemsRepo.save(item);
      await this.applyResolution(item, resolved);
      await this.scoreAccuracyAndUpdateStats(item.id, resolved);
    } else {
      await this.itemsRepo.save(item);
    }

    return { status: item.status, approvalScore: item.approvalScore, rejectionScore: item.rejectionScore };
  }

  private async applyResolution(item: ModerationItemEntity, resolved: 'verified' | 'rejected') {
    if (item.kind === 'new_place' && item.targetParkingSpotId) {
      if (resolved === 'verified') {
        await this.spotsRepo.update(item.targetParkingSpotId, { communityVerification: 'verified' });
      } else {
        // Keep the map clean: rejected places are removed from discovery for MVP.
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
    for (const userId of affectedUserIds) {
      const s = await this.getOrCreateStats(userId);
      const total = await this.votesRepo.count({ where: { userId } });
      const correct = await this.votesRepo.count({ where: { userId, isCorrect: true } });
      s.moderationVotesCount = total;
      s.moderationAccuracy = total ? correct / total : null;
      await this.statsRepo.save(s);
    }
  }
}

