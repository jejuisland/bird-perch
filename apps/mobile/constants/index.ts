export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';


export const DEFAULT_REGION = {
  latitude: 20,
  longitude: 0,
  latitudeDelta: 80,
  longitudeDelta: 80,
};

export const SEARCH_RADIUS_METERS = 3000;

/**
 * Perch color scheme — a confident blue identity kept from feeling flat via
 * gradients, glows, soft elevation, and a cyan→indigo heat ramp.
 * Values are the source of truth (see docs / marketing-site `globals.css`).
 */
export const COLORS = {
  // Brand
  primary: '#2563EB', // Primary actions, links, verified pins, focus rings
  primaryBright: '#3B7BF7', // Gradient top stop, highlights
  primaryLight: '#EFF6FF', // Accent surface (blue-50): tinted chips / icon backgrounds
  primaryDark: '#1D4ED8', // Pressed/active, accent text on light, gradient bottom stop
  primaryMuted: '#93C5FD', // Disabled primary fills

  // Secondary accent (sky)
  sky: '#0EA5E9', // Fills / icons only — not legible as text on light
  skyDeep: '#0369A1', // Sky used as text/icons on light backgrounds

  // Backgrounds
  background: '#FFFFFF',
  surface: '#F1F5F9', // Surface Subtle: muted fills, alternating sections, input bg
  surfaceElevated: '#FFFFFF',
  wash: '#EAF1FF', // Background wash top stop (behind hero/feature areas)

  // Text
  text: '#0E1726', // Ink — primary text + dark section backgrounds
  textSecondary: '#5B6573', // Muted/supporting (passes AA on white)
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',

  // Borders
  border: '#E3E6EB', // Hairline borders, dividers
  inputBorder: '#CBD5E1', // Form field borders
  borderFocus: '#2563EB',

  // Status — success
  success: '#16A34A',
  successLight: '#DCFCE7',

  // Status — danger
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  dangerBorder: '#FECACA',

  // Status — warning
  warning: '#D97706',
  warningLight: '#FEF3C7',
  warningText: '#92400E',
  warningBorder: '#FDE68A',

  // Status — info (Info === Primary per the scheme)
  info: '#2563EB',
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
  star: '#D97706', // Ratings (stars) use Amber
  accent: '#2563EB',
  walkRoute: '#D97706', // Walk-to-parked-car route/marker (Amber — distinct from blue drive route)
  heatLow: 'rgba(34, 211, 238, 0.45)', // cyan
  heatMid: 'rgba(37, 99, 235, 0.55)', // blue
  heatHigh: 'rgba(79, 70, 229, 0.70)', // indigo
  // Back-compat aliases (heat ramp endpoints)
  heatmapLow: 'rgba(34, 211, 238, 0.45)',
  heatmapHigh: 'rgba(79, 70, 229, 0.70)',
  markerDefault: '#2563EB',
  markerSelected: '#1D4ED8',
};

/**
 * Gradient stops (top → bottom) for `expo-linear-gradient`.
 * The "depth" system — apply to primary actions and key surfaces so the blue
 * never reads flat.
 */
export const GRADIENTS = {
  primaryButton: ['#3B7BF7', '#1D4ED8'] as const,
  primaryButtonPressed: ['#4685F8', '#2059D6'] as const,
  verifiedPin: ['#3B7BF7', '#1D4ED8'] as const,
  backgroundWash: ['#EAF1FF', '#FFFFFF'] as const,
} as const;

/** Elevation presets (Ink-based soft shadows + primary glow). */
export const SHADOWS = {
  /** Soft card elevation. */
  softCard: {
    shadowColor: '#0E1726',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  /** Blue glow under primary buttons. */
  primaryGlow: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 6,
  },
} as const;

/** Heatmap density ramp: cool cyan (low) → blue → deep indigo (high). RGB stops. */
export const HEAT_RAMP = {
  low: [34, 211, 238] as const, // cyan
  mid: [37, 99, 235] as const, // blue
  high: [79, 70, 229] as const, // indigo
} as const;

/**
 * Dark-section / dark-mode token set (defined, not yet wired — the app runs
 * light-only via app.json `userInterfaceStyle: "light"`). Adopting runtime
 * theming later can consume these without re-deriving values.
 */
export const DARK = {
  background: '#0E1726', // Ink
  surface: 'rgba(255,255,255,0.04)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.70)',
  border: 'rgba(255,255,255,0.14)',
  // Brighter accents read better on Ink than #2563EB
  accent: '#3B7BF7',
  sky: '#0EA5E9',
} as const;

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
