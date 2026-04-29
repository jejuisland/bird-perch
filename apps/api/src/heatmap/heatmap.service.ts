import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HeatmapPointEntity } from './heatmap-point.entity';
import { HeatmapPoint } from '@perch/shared';
import { CollectLocationDto } from './dto/collect-location.dto';
import { HeatmapQueryDto } from './dto/heatmap-query.dto';

const GRID_CELL_DEGREES = 0.001; // ~111m per cell

@Injectable()
export class HeatmapService {
  constructor(
    @InjectRepository(HeatmapPointEntity)
    private readonly repo: Repository<HeatmapPointEntity>,
  ) {}

  async collect(dto: CollectLocationDto): Promise<void> {
    const point = this.repo.create(dto);
    await this.repo.save(point);
  }

  async getAggregated(query: HeatmapQueryDto): Promise<HeatmapPoint[]> {
    const { latitude, longitude, radiusMeters = 5000 } = query;
    const radiusKm = radiusMeters / 1000;

    // Aggregate raw GPS points into grid cells and compute relative intensity
    const rows: Array<{ lat: string; lng: string; total_dwell: string }> = await this.repo
      .createQueryBuilder('p')
      .select(`ROUND(CAST(p.latitude AS numeric) / ${GRID_CELL_DEGREES}) * ${GRID_CELL_DEGREES}`, 'lat')
      .addSelect(`ROUND(CAST(p.longitude AS numeric) / ${GRID_CELL_DEGREES}) * ${GRID_CELL_DEGREES}`, 'lng')
      .addSelect('SUM(p.dwellSeconds)', 'total_dwell')
      .where(
        `(6371 * acos(cos(radians(:lat)) * cos(radians(p.latitude)) * cos(radians(p.longitude) - radians(:lng)) + sin(radians(:lat)) * sin(radians(p.latitude)))) <= :radius`,
        { lat: latitude, lng: longitude, radius: radiusKm },
      )
      .groupBy('lat, lng')
      .getRawMany();

    if (rows.length === 0) return [];

    const maxDwell = Math.max(...rows.map((r) => parseFloat(r.total_dwell)));
    return rows.map((r) => ({
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lng),
      weight: maxDwell > 0 ? parseFloat(r.total_dwell) / maxDwell : 0,
    }));
  }
}
