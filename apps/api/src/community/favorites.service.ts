import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FavoriteParkingSpotEntity } from './entities/favorite-parking-spot.entity';
import { ParkingSpotEntity } from '../parking-spots/parking-spot.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(FavoriteParkingSpotEntity)
    private readonly favoritesRepo: Repository<FavoriteParkingSpotEntity>,
    @InjectRepository(ParkingSpotEntity)
    private readonly spotsRepo: Repository<ParkingSpotEntity>,
  ) {}

  async listFavoriteSpots(userId: string): Promise<ParkingSpotEntity[]> {
    const favorites = await this.favoritesRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 200,
    });

    const ids = favorites.map((f) => f.parkingSpotId);
    if (!ids.length) return [];

    // Preserve ordering by favorites.createdAt.
    const spots = await this.spotsRepo.find({ where: { id: In(ids) } });
    const byId = new Map(spots.map((s) => [s.id, s]));
    return ids.map((id) => byId.get(id)).filter(Boolean) as ParkingSpotEntity[];
  }

  async add(userId: string, spotId: string) {
    const existing = await this.favoritesRepo.findOne({ where: { userId, parkingSpotId: spotId } });
    if (existing) return existing;
    return this.favoritesRepo.save(this.favoritesRepo.create({ userId, parkingSpotId: spotId }));
  }

  async remove(userId: string, spotId: string) {
    await this.favoritesRepo.delete({ userId, parkingSpotId: spotId });
    return { ok: true };
  }

  async isFavorited(userId: string, spotId: string): Promise<boolean> {
    const existing = await this.favoritesRepo.findOne({ where: { userId, parkingSpotId: spotId } });
    return !!existing;
  }
}

