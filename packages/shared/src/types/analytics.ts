export type AnalyticsEventType =
  | 'app_open'
  | 'map_pan'
  | 'map_zoom'
  | 'marker_tap'
  | 'heatmap_toggle'
  | 'search_query'
  | 'review_submit'
  | 'ad_impression';

export interface AnalyticsEvent {
  eventType: AnalyticsEventType;
  sessionId: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}
