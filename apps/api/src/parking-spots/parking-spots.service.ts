import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParkingSpotEntity } from './parking-spot.entity';
import { ParkingSpotPhotoEntity } from '../community/entities/parking-spot-photo.entity';
import { NearbyQueryDto } from './dto/nearby-query.dto';

@Injectable()
export class ParkingSpotsService {
  constructor(
    @InjectRepository(ParkingSpotEntity)
    private readonly repo: Repository<ParkingSpotEntity>,
    @InjectRepository(ParkingSpotPhotoEntity)
    private readonly photosRepo: Repository<ParkingSpotPhotoEntity>,
  ) {}

  // Uses Haversine formula via raw SQL — no PostGIS required for MVP.
  // When lat/lng are absent, returns all globally approved spots (limit 500).
  async findNearby(query: NearbyQueryDto): Promise<ParkingSpotEntity[]> {
    const { latitude, longitude, radiusMeters = 5000, openNow } = query;

    let spots: ParkingSpotEntity[];

    if (latitude == null || longitude == null) {
      spots = await this.repo
        .createQueryBuilder('spot')
        .where('(spot.communityVerification = :verified OR spot.communityVerification IS NULL)', { verified: 'verified' })
        .orderBy('spot.createdAt', 'DESC')
        .limit(500)
        .getMany();
    } else {
      const radiusKm = radiusMeters / 1000;
      spots = await this.repo
        .createQueryBuilder('spot')
        .where(
          `(
            6371 * acos(
              cos(radians(:lat)) * cos(radians(spot.latitude)) *
              cos(radians(spot.longitude) - radians(:lng)) +
              sin(radians(:lat)) * sin(radians(spot.latitude))
            )
          ) <= :radius`,
          { lat: latitude, lng: longitude, radius: radiusKm },
        )
        .andWhere('(spot.communityVerification = :verified OR spot.communityVerification IS NULL)', { verified: 'verified' })
        .orderBy(
          `(
            6371 * acos(
              cos(radians(:lat)) * cos(radians(spot.latitude)) *
              cos(radians(spot.longitude) - radians(:lng)) +
              sin(radians(:lat)) * sin(radians(spot.latitude))
            )
          )`,
          'ASC',
        )
        .setParameters({ lat: latitude, lng: longitude, radius: radiusKm })
        .limit(100)
        .getMany();
    }

    if (!openNow) return spots;
    return spots.filter((s) => this.isCurrentlyOpen(s.operatingHours));
  }

  async findById(id: string): Promise<ParkingSpotEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(data: Partial<ParkingSpotEntity>): Promise<ParkingSpotEntity> {
    // Admin-created spots bypass moderation and are always verified.
    const spot = this.repo.create({ communityVerification: 'verified', ...data });
    return this.repo.save(spot);
  }

  async findPhotos(spotId: string): Promise<Pick<ParkingSpotPhotoEntity, 'id' | 'publicUrl' | 'createdAt'>[]> {
    const photos = await this.photosRepo.find({
      where: { parkingSpotId: spotId, hiddenAt: null },
      order: { createdAt: 'ASC' },
      select: ['id', 'publicUrl', 'createdAt'],
    });
    return photos;
  }

  async updateRatingStats(id: string, newAvg: number, newCount: number) {
    await this.repo.update(id, { averageRating: newAvg, reviewCount: newCount });
  }

  // Parses operatingHours string against current Manila time (UTC+8).
  // Formats supported: "24h", "06:00-22:00", null/empty = assume open.
  private isCurrentlyOpen(operatingHours: string | null): boolean {
    if (!operatingHours || operatingHours === '24h') return true;

    const match = operatingHours.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (!match) return true;

    const [, oh, om, ch, cm] = match.map(Number);
    const now = new Date();
    const manilaMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + 8 * 60) % (24 * 60);

    return manilaMinutes >= oh * 60 + om && manilaMinutes <= ch * 60 + cm;
  }
}
