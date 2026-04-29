export interface Review {
  id: string;
  userId: string;
  userName: string;
  parkingSpotId: string;
  rating: number; // 1–5
  comment: string;
  createdAt: string;
}

export interface CreateReviewDto {
  rating: number;
  comment: string;
}
