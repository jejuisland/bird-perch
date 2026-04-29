import { IsString, IsOptional, IsNumber, IsEnum, Min, Max } from 'class-validator';
import { VehicleType } from '@perch/shared';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(16)
  @Max(100)
  age?: number;

  @IsOptional()
  @IsEnum(['motorcycle', 'sedan', 'suv', 'van'])
  vehicleType?: VehicleType;
}
