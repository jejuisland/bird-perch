import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContributorStatsEntity } from './entities/contributor-stats.entity';
import { ParkingSpotEntity } from '../parking-spots/parking-spot.entity';
import { ModerationItemEntity } from './entities/moderation-item.entity';
import { ParkingSpotPhotoEntity } from './entities/parking-spot-photo.entity';
import { UploadsService } from '../uploads/uploads.service';
import { CreateCommunityParkingSpotDto } from './dto/create-community-parking-spot.dto';
import { RateSummaryService } from './rate-summary.service';

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

// Spots within this radius of an existing spot are considered duplicates.
const DUPLICATE_RADIUS_METERS = 50;

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
    private readonly rateSummary: RateSummaryService,
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

    // Ensure every photo path was uploaded by this user. Paths are scoped to
    // `parking-photos/{userId}/` by the uploads service, so any other prefix
    // indicates a path hijack attempt.
    const expectedPrefix = `parking-photos/${userId}/`;
    for (const path of dto.photoStoragePaths) {
      if (!path.startsWith(expectedPrefix)) {
        throw new BadRequestException('One or more photo paths are invalid');
      }
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

    // Reject if an existing spot (verified or pending) already sits within
    // DUPLICATE_RADIUS_METERS. The client-side 60m check is UX-only.
    const nearby = await this.spotRepo
      .createQueryBuilder('spot')
      .where(
        `(
          6371000 * acos(
            cos(radians(:lat)) * cos(radians(spot.latitude)) *
            cos(radians(spot.longitude) - radians(:lng)) +
            sin(radians(:lat)) * sin(radians(spot.latitude))
          )
        ) <= :radius`,
        { lat: dto.latitude, lng: dto.longitude, radius: DUPLICATE_RADIUS_METERS },
      )
      .getOne();

    if (nearby) {
      throw new ConflictException({
        message: 'A parking spot already exists within 50m of this location',
        existingSpotId: nearby.id,
      });
    }

    let resolvedRates = dto.rates;
    let resolvedDetailedRates = dto.detailedRates;

    if (dto.detailedRates) {
      resolvedRates = this.rateSummary.generate(dto.detailedRates);
      if (!dto.detailedRates.dataConfidence) {
        resolvedDetailedRates = {
          ...dto.detailedRates,
          dataConfidence: this.rateSummary.inferConfidence(dto.detailedRates),
        };
      }
    }

    const spot = await this.spotRepo.save(
      this.spotRepo.create({
        name: dto.name,
        latitude: dto.latitude,
        longitude: dto.longitude,
        type: dto.type,
        rates: resolvedRates,
        detailedRates: resolvedDetailedRates,
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
            rates: resolvedRates ?? null,
            detailedRates: resolvedDetailedRates ?? null,
            operatingHours: dto.operatingHours ?? null,
            landmark: dto.landmark ?? null,
          },
          photoStoragePaths: dto.photoStoragePaths,
        },
      }),
    );

    const photos = dto.photoStoragePaths.map((storagePath) =>
      this.photoRepo.create({
        parkingSpotId: spot.id,
        uploadedByUserId: userId,
        storagePath,
        publicUrl: this.uploads.getPublicUrl(storagePath),
        communityApprovedAt: null,
        hiddenAt: null,
      }),
    );
    await this.photoRepo.save(photos);

    return { parkingSpotId: spot.id, moderationItemId: moderationItem.id };
  }

  async getMySubmissions(userId: string) {
    return this.moderationRepo.find({
      where: { submitterUserId: userId, kind: 'new_place' },
      order: { createdAt: 'DESC' },
    });
  }
}
