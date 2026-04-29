import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class CollectLocationDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsString()
  sessionId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dwellSeconds?: number;
}
