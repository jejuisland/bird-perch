export type ParkingType = 'street' | 'mall' | 'private_lot';
export type ParkingStatus = 'usually_busy' | 'usually_available' | 'unknown';
export type CommunityVerification = 'unverified' | 'verified';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface VehicleRate {
  freeMinutes?: number;
  validationMinutes?: number;
  firstHours?: number;
  firstRate?: number;
  succeedingRate?: number;
  flatRate?: number;
  /** @deprecated Use flatRateWindowStart/End instead */
  flatRateWindow?: string;
  flatRateWindowStart?: string;
  flatRateWindowEnd?: string;
  overnightCharge?: number;
  /** @deprecated Use overnightWindowStart/End instead */
  overnightCutoff?: string;
  overnightWindowStart?: string;
  overnightWindowEnd?: string;
  minimumCharge?: number;
  dailyMaxCap?: number;
  partialHourRounding?: 'ceil' | 'floor' | 'round';
  succeedingRateIntervalMinutes?: number;
}

export interface DetailedRates {
  car?: VehicleRate;
  motorcycle?: VehicleRate;
  van?: VehicleRate;
  truck?: VehicleRate;
  lostTicketFee?: number;
  damagedCardFee?: number;
  penaltyNotes?: string;
  notes?: string;
  rawText?: string;
  dataConfidence?: 'low' | 'medium' | 'high';
  timezone?: string;
  currency?: string;
  validationDiscount?: {
    discountMinutes?: number;
    discountPercent?: number;
  };
  lastVerifiedAt?: string;
  rateVersion?: number;
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
  communityVerification?: CommunityVerification;
  submittedByUserId?: string | null;
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
