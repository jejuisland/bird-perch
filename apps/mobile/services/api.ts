import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants';
import type {
  CreateCommunityParkingSpotDto,
  CreateCommunityParkingSpotResponse,
  CreateUploadUrlResponse,
  ContributorStats,
  ModerationQueueItem,
  ParkingSpot,
} from '@perch/shared';

export const apiClient = axios.create({ baseURL: API_BASE_URL });

let _isRefreshing = false;
let _refreshQueue: Array<(token: string) => void> = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Don't try to refresh if the failing request IS the refresh call
    if (original.url?.includes('/auth/refresh')) {
      delete apiClient.defaults.headers.common['Authorization'];
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
      return Promise.reject(error);
    }

    if (_isRefreshing) {
      return new Promise((resolve) => {
        _refreshQueue.push((token) => {
          original.headers['Authorization'] = `Bearer ${token}`;
          resolve(apiClient(original));
        });
      });
    }

    original._retry = true;
    _isRefreshing = true;

    try {
      const storedRefresh = await AsyncStorage.getItem('refreshToken');
      if (!storedRefresh) throw new Error('no refresh token');

      const { data } = await apiClient.post('/auth/refresh', { refreshToken: storedRefresh });
      const newAccess: string = data.accessToken;
      const newRefresh: string = data.refreshToken;

      await AsyncStorage.setItem('accessToken', newAccess);
      await AsyncStorage.setItem('refreshToken', newRefresh);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;

      _refreshQueue.forEach((cb) => cb(newAccess));
      _refreshQueue = [];

      original.headers['Authorization'] = `Bearer ${newAccess}`;
      return apiClient(original);
    } catch {
      delete apiClient.defaults.headers.common['Authorization'];
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
      return Promise.reject(error);
    } finally {
      _isRefreshing = false;
    }
  },
);

export const authApi = {
  register: (data: {
    name: string;
    email: string;
    mobileNumber?: string;
    age: number;
    vehicleType: string;
    password?: string;
  }) => apiClient.post('/auth/register', data).then((r) => r.data as { message: string }),

  loginWithPassword: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }).then((r) => r.data as {
      accessToken: string;
      refreshToken: string;
    }),

  sendOtp: (email: string) =>
    apiClient.post('/auth/send-otp', { email }).then((r) => r.data),

  verifyOtp: (email: string, code: string) =>
    apiClient.post('/auth/verify-otp', { email, code }).then((r) => r.data as {
      accessToken: string;
      refreshToken: string;
      isNewUser: boolean;
    }),
};

export const parkingApi = {
  getNearby: (lat: number, lng: number, radiusMeters = 5000, openNow?: boolean) =>
    apiClient
      .get('/parking-spots', { params: { latitude: lat, longitude: lng, radiusMeters, openNow } })
      .then((r) => r.data),
  getById: (id: string) => apiClient.get(`/parking-spots/${id}`).then((r) => r.data),
};

export const uploadsApi = {
  createParkingPhotoUpload: (data: { contentType: string; fileExt?: string }) =>
    apiClient.post('/uploads/parking-photo', data).then((r) => r.data as CreateUploadUrlResponse),
};

export const communityParkingApi = {
  submitNewPlace: (data: CreateCommunityParkingSpotDto) =>
    apiClient.post('/parking-spots/community', data).then((r) => r.data as CreateCommunityParkingSpotResponse),
};

export interface ModerationQueuePage {
  items: ModerationQueueItem[];
  total: number;
  page: number;
  totalPages: number;
}

export const moderationApi = {
  queue: (page = 1, limit = 5) =>
    apiClient
      .get('/moderation/queue', { params: { page, limit } })
      .then((r) => r.data as ModerationQueuePage),
  vote: (itemId: string, approve: boolean) =>
    apiClient.post(`/moderation/items/${itemId}/vote`, { approve }).then((r) => r.data),
};

export const favoritesApi = {
  list: () => apiClient.get('/users/me/favorites').then((r) => r.data as ParkingSpot[]),
  add: (spotId: string) => apiClient.post(`/users/me/favorites/${spotId}`).then((r) => r.data),
  remove: (spotId: string) => apiClient.delete(`/users/me/favorites/${spotId}`).then((r) => r.data),
};

export const contributorsApi = {
  me: () => apiClient.get('/users/me/contributor-stats').then((r) => r.data as ContributorStats),
};

export const reviewsApi = {
  getBySpot: (spotId: string) =>
    apiClient.get(`/parking-spots/${spotId}/reviews`).then((r) => r.data),
  create: (spotId: string, data: { rating: number; comment?: string }) =>
    apiClient.post(`/parking-spots/${spotId}/reviews`, data).then((r) => r.data),
};

export const heatmapApi = {
  getAggregated: (lat: number, lng: number, radiusMeters = 5000) =>
    apiClient
      .get('/heatmap', { params: { latitude: lat, longitude: lng, radiusMeters } })
      .then((r) => r.data),
  collect: (data: { latitude: number; longitude: number; sessionId: string; dwellSeconds?: number }) =>
    apiClient.post('/heatmap/collect', data),
};

export const usersApi = {
  me: () => apiClient.get('/users/me').then((r) => r.data),
  updateMe: (data: Record<string, unknown>) => apiClient.put('/users/me', data).then((r) => r.data),
};

export const analyticsApi = {
  track: (data: { eventType: string; sessionId: string; metadata?: Record<string, unknown> }) =>
    apiClient.post('/analytics/events', data).catch(() => {}),
};
