import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { AnalyticsEventType } from '@perch/shared';

export class TrackEventDto {
  @IsEnum([
    'app_open', 'map_pan', 'map_zoom', 'marker_tap',
    'heatmap_toggle', 'search_query', 'review_submit', 'ad_impression',
  ])
  eventType: AnalyticsEventType;

  @IsString()
  sessionId: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  timestamp?: string;
}
