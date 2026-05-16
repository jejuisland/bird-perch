import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContributorStatsEntity } from './entities/contributor-stats.entity';
import { ParkingSpotEntity } from '../parking-spots/parking-spot.entity';
import { ModerationItemEntity } from './entities/moderation-item.entity';
import { ParkingSpotPhotoEntity } from './entities/parking-spot-photo.entity';
import { UploadsService } from '../uploads/uploads.service';
import { CreateCommunityParkingSpotDto } from './dto/create-community-parking-spot.dto';

function tierRadiusMeters(tier: 'pigeon' | 'hawk' | 'eagle'): number {
  if (tier === 'hawk') return 500;
  if (tier === 'eagle') return Number.POSITIVE_INFINITY;
  return 200;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class CommunitySubmissionsService {
  constructor(
    @InjectRepository(ContributorStatsEntity)
    private readonly statsRepo: Repository<ContributorStatsEntity>,
    @InjectRepository(ParkingSpotEntity)
    private readonly spotRepo: Repository<ParkingSpotEntity>,
    @InjectRepository(ModerationItemEntity)
    private readonly moderationRepo: Repository<ModerationItemEntity>,
    @InjectRepository(ParkingSpotPhotoEntity)
    private readonly photoRepo: Repository<ParkingSpotPhotoEntity>,
    private readonly uploads: UploadsService,
  ) {}

  async getOrCreateStats(userId: string): Promise<ContributorStatsEntity> {
    const existing = await this.statsRepo.findOne({ where: { userId } });
    if (existing) return existing;
    return this.statsRepo.save(this.statsRepo.create({ userId, tier: 'pigeon' }));
  }

  async submitNewPlace(userId: string, dto: CreateCommunityParkingSpotDto) {
    if (!dto.photoStoragePaths?.length) {
      throw new BadRequestException('At least one photo is required');
    }

    const stats = await this.getOrCreateStats(userId);

    const maxDist = tierRadiusMeters(stats.tier);
    if (Number.isFinite(maxDist)) {
      const d = haversineMeters(
        dto.submissionLatitude,
        dto.submissionLongitude,
        dto.latitude,
        dto.longitude,
      );
      if (d > maxDist) {
        throw new BadRequestException(`Pin must be within ${Math.round(maxDist)}m of your location`);
      }
    }

    const spot = await this.spotRepo.save(
      this.spotRepo.create({
        name: dto.name,
        latitude: dto.latitude,
        longitude: dto.longitude,
        type: dto.type,
        rates: dto.rates,
        operatingHours: dto.operatingHours,
        communityVerification: 'unverified',
        submittedByUserId: userId,
      }),
    );

    const moderationItem = await this.moderationRepo.save(
      this.moderationRepo.create({
        kind: 'new_place',
        status: 'pending',
        targetParkingSpotId: spot.id,
        submitterUserId: userId,
        payload: {
          spot: {
            name: dto.name,
            latitude: dto.latitude,
            longitude: dto.longitude,
            type: dto.type,
            rates: dto.rates ?? null,
            operatingHours: dto.operatingHours ?? null,
          },
          photoStoragePaths: dto.photoStoragePaths,
        },
      }),
    );

    // Persist photos immediately, but leave them unapproved for moderation flow.
    const photos = dto.photoStoragePaths.map((storagePath) => {
      return this.photoRepo.create({
        parkingSpotId: spot.id,
        uploadedByUserId: userId,
        storagePath,
        publicUrl: this.uploads.getPublicUrl(storagePath),
        communityApprovedAt: null,
        hiddenAt: null,
      });
    });
    await this.photoRepo.save(photos);

    return { parkingSpotId: spot.id, moderationItemId: moderationItem.id };
  }
}

