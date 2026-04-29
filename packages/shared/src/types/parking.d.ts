export type ParkingType = 'street' | 'mall' | 'private_lot';
export type ParkingStatus = 'usually_busy' | 'usually_available' | 'unknown';
export interface Coordinates {
    latitude: number;
    longitude: number;
}
export interface ParkingSpot {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    type: ParkingType;
    rates: string;
    operatingHours: string;
    averageRating: number;
    reviewCount: number;
    status: ParkingStatus;
    createdAt: string;
    updatedAt: string;
}
export interface ParkingSpotNearbyQuery {
    latitude: number;
    longitude: number;
    radiusMeters?: number;
}
