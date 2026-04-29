import { IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class HeatmapQueryDto {
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  radiusMeters?: number;
}
