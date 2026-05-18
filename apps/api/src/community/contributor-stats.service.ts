import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContributorStatsEntity } from './entities/contributor-stats.entity';

@Injectable()
export class ContributorStatsService {
  constructor(
    @InjectRepository(ContributorStatsEntity)
    private readonly statsRepo: Repository<ContributorStatsEntity>,
  ) {}

  async getOrCreate(userId: string): Promise<ContributorStatsEntity> {
    const existing = await this.statsRepo.findOne({ where: { userId } });
    if (existing) return existing;
    return this.statsRepo.save(this.statsRepo.create({ userId, tier: 'pigeon' }));
  }
}

