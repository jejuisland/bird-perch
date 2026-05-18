export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const DEFAULT_REGION = {
  latitude: 14.5547,
  longitude: 121.0244,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export const SEARCH_RADIUS_METERS = 3000;

export const COLORS = {
  // Brand
  primary: '#2563EB',
  primaryLight: '#EFF6FF',
  primaryDark: '#1D4ED8',

  // Backgrounds
  background: '#FFFFFF',
  surface: '#F8FAFC',
  surfaceElevated: '#FFFFFF',

  // Text
  text: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',

  // Borders
  border: '#E2E8F0',
  borderFocus: '#2563EB',

  // Status — success
  success: '#16A34A',
  successLight: '#DCFCE7',

  // Status — danger
  danger: '#DC2626',
  dangerLight: '#FEE2E2',

  // Status — warning
  warning: '#D97706',
  warningLight: '#FEF3C7',
  warningText: '#92400E',

  // Status — info
  info: '#1E40AF',
  infoLight: '#EFF6FF',
  infoBorder: '#BFDBFE',

  // Tier colors
  tierPigeon: '#64748B',
  tierPigeonBg: '#F1F5F9',
  tierHawk: '#0EA5E9',
  tierHawkBg: '#F0F9FF',
  tierEagle: '#D97706',
  tierEagleBg: '#FFFBEB',

  // Map / specialty
  star: '#F59E0B',
  accent: '#2563EB',
  heatmapLow: 'rgba(37, 99, 235, 0.2)',
  heatmapHigh: 'rgba(239, 68, 68, 0.8)',
  markerDefault: '#2563EB',
  markerSelected: '#1D4ED8',
};

/** Tier badge color pair — background + text */
export const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pigeon: { bg: COLORS.tierPigeonBg, text: COLORS.tierPigeon, border: '#CBD5E1' },
  hawk: { bg: COLORS.tierHawkBg, text: COLORS.tierHawk, border: '#BAE6FD' },
  eagle: { bg: COLORS.tierEagleBg, text: COLORS.tierEagle, border: '#FDE68A' },
};

/** Points required to reach each tier */
export const TIER_THRESHOLDS = {
  pigeon: 0,
  hawk: 50,
  eagle: 200,
} as const;

export type TierName = keyof typeof TIER_THRESHOLDS;

export function nextTier(current: TierName): TierName | null {
  if (current === 'pigeon') return 'hawk';
  if (current === 'hawk') return 'eagle';
  return null;
}

export function tierProgress(points: number, current: TierName): number {
  const next = nextTier(current);
  if (!next) return 1;
  const from = TIER_THRESHOLDS[current];
  const to = TIER_THRESHOLDS[next];
  return Math.min((points - from) / (to - from), 1);
}

export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_MARGIN_BOTTOM = 12;
