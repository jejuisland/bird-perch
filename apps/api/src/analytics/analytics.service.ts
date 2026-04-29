import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEventEntity } from './analytics-event.entity';
import { TrackEventDto } from './dto/track-event.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEventEntity)
    private readonly repo: Repository<AnalyticsEventEntity>,
  ) {}

  async track(dto: TrackEventDto): Promise<void> {
    const event = this.repo.create({
      ...dto,
      createdAt: dto.timestamp ? new Date(dto.timestamp) : undefined,
    });
    await this.repo.save(event);
  }
}
