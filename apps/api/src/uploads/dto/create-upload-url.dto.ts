import { IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateUploadUrlDto {
  @IsString()
  contentType: string;

  @IsOptional()
  @IsString()
  fileExt?: string;

  @IsOptional()
  @IsNumber()
  sizeBytes?: number;
}

