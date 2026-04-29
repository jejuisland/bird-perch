export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number; // 0–1 normalized intensity
}

export interface HeatmapQuery {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}

export interface CollectLocationDto {
  latitude: number;
  longitude: number;
  sessionId: string; // anonymized client-generated UUID
  dwellSeconds?: number;
}
