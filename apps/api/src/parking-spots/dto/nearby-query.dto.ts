import { IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class NearbyQueryDto {
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(20000)
  radiusMeters?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  openNow?: boolean;
}
