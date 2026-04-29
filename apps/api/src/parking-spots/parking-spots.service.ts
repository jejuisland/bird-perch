import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParkingSpotEntity } from './parking-spot.entity';
import { NearbyQueryDto } from './dto/nearby-query.dto';

@Injectable()
export class ParkingSpotsService {
  constructor(
    @InjectRepository(ParkingSpotEntity)
    private readonly repo: Repository<ParkingSpotEntity>,
  ) {}

  // Uses Haversine formula via raw SQL — PostGIS ST_DWithin is preferred but
  // this works without the PostGIS extension for the initial MVP setup.
  async findNearby(query: NearbyQueryDto): Promise<ParkingSpotEntity[]> {
    const { latitude, longitude, radiusMeters = 5000 } = query;
    const radiusKm = radiusMeters / 1000;

    return this.repo
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
      .orderBy(
        `(
          6371 * acos(
            cos(radians(${latitude})) * cos(radians(spot.latitude)) *
            cos(radians(spot.longitude) - radians(${longitude})) +
            sin(radians(${latitude})) * sin(radians(spot.latitude))
          )
        )`,
        'ASC',
      )
      .limit(100)
      .getMany();
  }

  async findById(id: string): Promise<ParkingSpotEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(data: Partial<ParkingSpotEntity>): Promise<ParkingSpotEntity> {
    const spot = this.repo.create(data);
    return this.repo.save(spot);
  }

  async updateRatingStats(id: string, newAvg: number, newCount: number) {
    await this.repo.update(id, { averageRating: newAvg, reviewCount: newCount });
  }
}
