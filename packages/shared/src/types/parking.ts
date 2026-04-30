export type ParkingType = 'street' | 'mall' | 'private_lot';
export type ParkingStatus = 'usually_busy' | 'usually_available' | 'unknown';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface VehicleRate {
  freeMinutes?: number;
  firstHours?: number;
  firstRate?: number;
  succeedingRate?: number;
  flatRate?: number;
  flatRateWindow?: string;
  overnightCharge?: number;
  overnightCutoff?: string;
}

export interface DetailedRates {
  car?: VehicleRate;
  motorcycle?: VehicleRate;
  van?: VehicleRate;
  lostTicketFee?: number;
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
  address?: string;
  contactNumber?: string;
  totalSlots?: number;
  detailedRates?: DetailedRates;
  rules?: string[];
  facilities?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ParkingSpotNearbyQuery {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}
