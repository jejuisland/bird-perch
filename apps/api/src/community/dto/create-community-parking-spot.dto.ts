import { IsArray, IsEnum, IsNumber, IsOptional, IsString, ArrayMinSize, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ParkingType, DetailedRates } from '@perch/shared';

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
  @IsObject()
  detailedRates?: DetailedRates;

  @IsOptional()
  @IsString()
  operatingHours?: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsArray()
  @ArrayMinSize(1)
  photoStoragePaths: string[];

  @IsNumber()
  submissionLatitude: number;

  @IsNumber()
  submissionLongitude: number;
}

