import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdEntity } from './ad.entity';

const SUPABASE_ADS = 'https://trupfmmxeyocmistzkkx.supabase.co/storage/v1/object/public/ads';

const SEED_ADS: Partial<AdEntity>[] = [
  {
    title: 'SM Mall Parking — Reserve in advance',
    advertiserName: 'SM Prime Holdings',
    type: 'image',
    contentUrl: `${SUPABASE_ADS}/sm-parking.jpg`,
    targetUrl: 'https://www.smprime.com',
    isActive: true,
    durationSeconds: 8,
    displayOrder: 1,
  },
  {
    title: 'AutoSure — Protect your vehicle from ₱99/mo',
    advertiserName: 'AutoSure Insurance',
    type: 'image',
    contentUrl: `${SUPABASE_ADS}/autosure.jpg`,
    targetUrl: null,
    isActive: true,
    durationSeconds: 10,
    displayOrder: 2,
  },
  {
    title: 'Grab Parking — Skip the queue',
    advertiserName: 'Grab Philippines',
    type: 'image',
    contentUrl: `${SUPABASE_ADS}/grab-parking.jpg`,
    targetUrl: null,
    isActive: true,
    durationSeconds: 12,
    displayOrder: 3,
  },
];

@Injectable()
export class AdsService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(AdEntity)
    private readonly repo: Repository<AdEntity>,
  ) {}

  async onApplicationBootstrap() {
    const count = await this.repo.count();
    if (count === 0) {
      await this.repo.save(this.repo.create(SEED_ADS as AdEntity[]));
    }
  }

  findActive(): Promise<AdEntity[]> {
    const now = new Date();
    return this.repo
      .createQueryBuilder('ad')
      .where('ad.isActive = true')
      .andWhere('(ad.startDate IS NULL OR ad.startDate <= :now)', { now })
      .andWhere('(ad.endDate IS NULL OR ad.endDate >= :now)', { now })
      .orderBy('ad.displayOrder', 'ASC')
      .getMany();
  }

  findAll(): Promise<AdEntity[]> {
    return this.repo.find({ order: { displayOrder: 'ASC' } });
  }

  create(data: Partial<AdEntity>): Promise<AdEntity> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<AdEntity>): Promise<AdEntity> {
    await this.repo.update(id, data);
    return this.repo.findOneOrFail({ where: { id } });
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
