import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContributorStatsEntity } from './entities/contributor-stats.entity';
import { ContributorTier } from '@perch/shared';

function tierFromPoints(points: number): ContributorTier {
  if (points >= 200) return 'eagle';
  if (points >= 50)  return 'hawk';
  return 'pigeon';
}

@Injectable()
export class ContributorStatsService {
  constructor(
    @InjectRepository(ContributorStatsEntity)
    private readonly statsRepo: Repository<ContributorStatsEntity>,
  ) {}

  async getOrCreate(userId: string): Promise<ContributorStatsEntity> {
    const existing = await this.statsRepo.findOne({ where: { userId } });
    if (existing) {
      // Keep stored tier in sync with actual points — handles manual DB edits
      // and any edge cases where the tier column drifts out of sync.
      const correctTier = tierFromPoints(existing.contributionPoints);
      if (existing.tier !== correctTier) {
        existing.tier = correctTier;
        await this.statsRepo.save(existing);
      }
      return existing;
    }
    return this.statsRepo.save(this.statsRepo.create({ userId, tier: 'pigeon' }));
  }
}

