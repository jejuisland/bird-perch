import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewEntity } from './review.entity';
import { ParkingSpotsService } from '../parking-spots/parking-spots.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ReviewEntity)
    private readonly repo: Repository<ReviewEntity>,
    private readonly parkingSpotsService: ParkingSpotsService,
  ) {}

  async findBySpot(parkingSpotId: string): Promise<ReviewEntity[]> {
    return this.repo.find({
      where: { parkingSpotId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async create(userId: string, parkingSpotId: string, dto: CreateReviewDto): Promise<ReviewEntity> {
    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const review = this.repo.create({ userId, parkingSpotId, ...dto });
    const saved = await this.repo.save(review);

    // Recompute average rating for the spot
    const { avg, count } = await this.repo
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'avg')
      .addSelect('COUNT(*)', 'count')
      .where('r.parkingSpotId = :parkingSpotId', { parkingSpotId })
      .getRawOne();

    await this.parkingSpotsService.updateRatingStats(parkingSpotId, parseFloat(avg), parseInt(count));

    return saved;
  }
}
