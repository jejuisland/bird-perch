export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const DEFAULT_REGION = {
  latitude: 14.5547,
  longitude: 121.0244,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export const SEARCH_RADIUS_METERS = 5000;

export const COLORS = {
  primary: '#2563EB',
  background: '#FFFFFF',
  surface: '#F3F4F6',
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  accent: '#2563EB',
  heatmapLow: 'rgba(37, 99, 235, 0.2)',
  heatmapHigh: 'rgba(239, 68, 68, 0.8)',
  markerDefault: '#2563EB',
  markerSelected: '#1D4ED8',
  star: '#F59E0B',
};
