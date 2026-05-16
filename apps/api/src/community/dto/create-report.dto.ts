import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReportDto {
  @IsEnum(['review', 'photo', 'update'])
  targetType: 'review' | 'photo' | 'update';

  @IsUUID()
  targetId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
