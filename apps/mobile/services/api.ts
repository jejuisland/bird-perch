import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants';

export const apiClient = axios.create({ baseURL: API_BASE_URL });

apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  register: (data: Parameters<typeof import('@perch/shared')['RegisterDto']>[0]) =>
    apiClient.post('/auth/register', data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    apiClient.post('/auth/login', data).then((r) => r.data),
};

export const parkingApi = {
  getNearby: (lat: number, lng: number, radiusMeters = 5000) =>
    apiClient
      .get('/parking-spots', { params: { latitude: lat, longitude: lng, radiusMeters } })
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

export const analyticsApi = {
  track: (data: {
    eventType: string;
    sessionId: string;
    metadata?: Record<string, unknown>;
  }) => apiClient.post('/analytics/events', data).catch(() => {}), // fire-and-forget
};
