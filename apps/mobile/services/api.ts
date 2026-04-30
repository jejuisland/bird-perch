import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants';

export const apiClient = axios.create({ baseURL: API_BASE_URL });

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      delete apiClient.defaults.headers.common['Authorization'];
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
    }
    return Promise.reject(error);
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
