import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { ParkingType } from '@perch/shared';

export class CreateParkingSpotDto {
  @IsString()
  name: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsEnum(['street', 'mall', 'private_lot'])
  type: ParkingType;

  @IsOptional()
  @IsString()
  rates?: string;

  @IsOptional()
  @IsString()
  operatingHours?: string;
}
