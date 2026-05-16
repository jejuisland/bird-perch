import type { ParkingType } from './parking';

export type ContributorTier = 'pigeon' | 'hawk' | 'eagle';

export type ModerationItemKind =
  | 'new_place'
  | 'metadata_update'
  | 'pin_move'
  | 'photo'
  | 'report_escalation';

export type ModerationItemStatus = 'pending' | 'verified' | 'rejected' | 'superseded';

export interface TierWeights {
  pigeon: 1;
  hawk: 2;
  eagle: 3;
}

export interface ContributorStats {
  userId: string;
  tier: ContributorTier;
  contributionPoints: number;
  verifiedPlacesCount: number;
  acceptedReviewsCount: number;
  acceptedPhotosCount: number;
  acceptedUpdatesCount: number;
  moderationVotesCount: number;
  moderationAccuracy?: number | null;
  contributionStreakDays?: number | null;
  lastContributionAt?: string | null;
  updatedAt: string;
}

export interface ParkingSpotPhoto {
  id: string;
  parkingSpotId: string;
  uploadedByUserId: string;
  storagePath: string;
  publicUrl: string;
  communityApprovedAt?: string | null;
  hiddenAt?: string | null;
  createdAt: string;
}

export interface CreateCommunityParkingSpotDto {
  name: string;
  latitude: number;
  longitude: number;
  type: ParkingType;
  rates?: string;
  operatingHours?: string;
  photoStoragePaths: string[];
  submissionLatitude: number;
  submissionLongitude: number;
}

export interface CreateCommunityParkingSpotResponse {
  parkingSpotId: string;
  moderationItemId: string;
}

export interface CreateUploadUrlDto {
  contentType: string;
  fileExt?: string;
  sizeBytes?: number;
}

export interface CreateUploadUrlResponse {
  uploadUrl: string;
  storagePath: string;
  publicUrl: string;
  expiresAt: string;
}

export interface ModerationQueueItem {
  id: string;
  kind: ModerationItemKind;
  status: ModerationItemStatus;
  createdAt: string;
  targetParkingSpotId?: string | null;
  submitterUserId?: string | null;
  submitterTier?: ContributorTier | null;
  payload: Record<string, unknown>;
  approvalScore: number;
  rejectionScore: number;
}

export interface CastModerationVoteDto {
  approve: boolean;
}

export type ReportTargetType = 'review' | 'photo' | 'update';

export interface CreateReportDto {
  targetType: ReportTargetType;
  targetId: string;
  reason?: string;
}

export interface HelpfulVoteDto {
  value: 'helpful' | 'not_helpful';
}

export interface FavoriteParkingSpot {
  parkingSpotId: string;
  createdAt: string;
}

