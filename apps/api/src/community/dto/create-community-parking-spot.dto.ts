import { IsArray, IsEnum, IsNumber, IsOptional, IsString, ArrayMinSize } from 'class-validator';
import { ParkingType } from '@perch/shared';

export class CreateCommunityParkingSpotDto {
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

  @IsArray()
  @ArrayMinSize(1)
  photoStoragePaths: string[];

  @IsNumber()
  submissionLatitude: number;

  @IsNumber()
  submissionLongitude: number;
}

