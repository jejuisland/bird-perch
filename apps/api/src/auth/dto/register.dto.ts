import { IsEmail, IsString, IsNumber, IsEnum, MinLength, Min, Max } from 'class-validator';
import { VehicleType } from '@perch/shared';

export class RegisterDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  mobileNumber: string;

  @IsNumber()
  @Min(16)
  @Max(100)
  age: number;

  @IsEnum(['motorcycle', 'sedan', 'suv', 'van'])
  vehicleType: VehicleType;
}
