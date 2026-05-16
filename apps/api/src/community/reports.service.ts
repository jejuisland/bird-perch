import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportEntity } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';

// Maximum reports a single user can file per calendar day (Manila time, UTC+8).
const DAILY_REPORT_LIMIT = 10;

function manilaDateKey(): string {
  const now = new Date();
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return manila.toISOString().slice(0, 10); // YYYY-MM-DD
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ReportEntity)
    private readonly reportsRepo: Repository<ReportEntity>,
  ) {}

  async create(userId: string, dto: CreateReportDto): Promise<ReportEntity> {
    const dayKey = manilaDateKey();

    const todayCount = await this.reportsRepo.count({
      where: { reporterUserId: userId, dayKey },
    });

    if (todayCount >= DAILY_REPORT_LIMIT) {
      throw new ConflictException(`You have reached the daily report limit (${DAILY_REPORT_LIMIT})`);
    }

    // Prevent duplicate reports for the same target on the same day.
    const duplicate = await this.reportsRepo.findOne({
      where: { reporterUserId: userId, targetId: dto.targetId, dayKey },
    });
    if (duplicate) {
      throw new ConflictException('You have already reported this item today');
    }

    return this.reportsRepo.save(
      this.reportsRepo.create({
        reporterUserId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason ?? null,
        dayKey,
      }),
    );
  }
}
