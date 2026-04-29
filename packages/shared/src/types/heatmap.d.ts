export interface HeatmapPoint {
    latitude: number;
    longitude: number;
    weight: number;
}
export interface HeatmapQuery {
    latitude: number;
    longitude: number;
    radiusMeters?: number;
}
export interface CollectLocationDto {
    latitude: number;
    longitude: number;
    sessionId: string;
    dwellSeconds?: number;
}
