import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useMapStore } from '../../store/mapStore';
import {
  COLORS,
  TIER_COLORS,
  TIER_THRESHOLDS,
  tierFromPoints,
  tierProgress,
  nextTier,
  type TierName,
} from '../../constants';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contributorsApi, favoritesApi, moderationApi } from '../../services/api';
import type { ParkingSpot, ModerationQueueItem } from '@perch/shared';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ width, height = 14, style }: { width: number | string; height?: number; style?: object }) {
  const opacity = React.useRef(new Animated.Value(0.35)).current;

  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: 6, backgroundColor: COLORS.border }, { opacity }, style]}
    />
  );
}

// ─── Tier images & metadata ───────────────────────────────────────────────────

const TIER_IMAGES: Record<string, ReturnType<typeof require>> = {
  pigeon: require('../../assets/pigeon.png'),
  hawk:   require('../../assets/hawk.png'),
  eagle:  require('../../assets/eagle.png'),
};

const TIER_META: Record<string, {
  label: string; subtitle: string;
  gradient: readonly [string, string, string];
  glowColor: string; perks: readonly [string, string];
}> = {
  pigeon: {
    label: 'Pigeon', subtitle: 'City Spotter',
    gradient: ['#E8ECF2', '#F1F5F9', '#FFFFFF'],
    glowColor: '#94A3B8',
    perks: ['200m radius', '×1 vote'],
  },
  hawk: {
    label: 'Hawk', subtitle: 'Trusted Scout',
    gradient: ['#DBEAFE', '#EFF6FF', '#FFFFFF'],
    glowColor: '#3B82F6',
    perks: ['500m radius', '×2 votes'],
  },
  eagle: {
    label: 'Eagle', subtitle: 'Master Navigator',
    gradient: ['#FEF3C7', '#FFFBEB', '#FFFFFF'],
    glowColor: '#F59E0B',
    perks: ['Unlimited radius', '×3 votes'],
  },
};

const TIER_ORDER: Record<TierName, number> = { pigeon: 0, hawk: 1, eagle: 2 };
const TIERS: TierName[] = ['pigeon', 'hawk', 'eagle'];

// ─── Tier Card ────────────────────────────────────────────────────────────────

function TierCard({ tier, points, accuracy, verifiedSpots, acceptedReviews, streakDays }: {
  tier: string; points: number; accuracy: number | null;
  verifiedSpots: number; acceptedReviews: number; streakDays: number | null;
}) {
  const tierKey  = (tier ?? 'pigeon') as TierName;
  const meta     = TIER_META[tierKey] ?? TIER_META.pigeon;
  const tc       = TIER_COLORS[tierKey] ?? TIER_COLORS.pigeon;
  const next     = nextTier(tierKey);
  const prog     = tierProgress(points, tierKey);
  const nextLabel    = next ? next.charAt(0).toUpperCase() + next.slice(1) : null;
  const pointsToNext = next ? TIER_THRESHOLDS[next] - points : null;

  const float     = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowAlpha = useRef(new Animated.Value(0.45)).current;
  const shimmerX  = useRef(new Animated.Value(-120)).current;
  const barWidth  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    float.setValue(0);
    glowScale.setValue(1);
    glowAlpha.setValue(0.45);
    shimmerX.setValue(-120);
    barWidth.setValue(0);

    const floatA = Animated.loop(
      Animated.sequence([
        Animated.timing(float,     { toValue: -9,  duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float,     { toValue: 0,   duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const glowA = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScale, { toValue: 1.24, duration: 1600, useNativeDriver: true }),
          Animated.timing(glowAlpha, { toValue: 0.10, duration: 1600, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(glowScale, { toValue: 1.0,  duration: 1600, useNativeDriver: true }),
          Animated.timing(glowAlpha, { toValue: 0.45, duration: 1600, useNativeDriver: true }),
        ]),
      ])
    );
    const shimA = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, { toValue: 360, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
        Animated.delay(3400),
        Animated.timing(shimmerX, { toValue: -120, duration: 0, useNativeDriver: true }),
      ])
    );
    const barA = Animated.timing(barWidth, {
      toValue: prog, duration: 1100, delay: 350,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    });

    floatA.start(); glowA.start(); shimA.start(); barA.start();
    return () => { floatA.stop(); glowA.stop(); shimA.stop(); barA.stop(); };
  }, [tierKey]);

  return (
    <View style={tc_s.card}>
      {/* ── Gradient hero ── */}
      <LinearGradient colors={meta.gradient as any} style={tc_s.hero}>
        {/* Shimmer sweep */}
        <Animated.View style={[tc_s.shimmerStripe, { transform: [{ translateX: shimmerX }] }]} />

        {/* Floating bird + glow ring */}
        <View style={tc_s.birdWrap}>
          <Animated.View
            style={[tc_s.glowRing, {
              backgroundColor: meta.glowColor,
              transform: [{ scale: glowScale }],
              opacity: glowAlpha,
            }]}
          />
          <Animated.Image
            source={TIER_IMAGES[tierKey]}
            style={[tc_s.birdImg, { transform: [{ translateY: float }] }]}
          />
        </View>

        {/* Tier name + subtitle */}
        <Text style={[tc_s.tierName, { color: tc.text }]}>{meta.label.toUpperCase()}</Text>
        <Text style={tc_s.tierSub}>{meta.subtitle}</Text>

        {/* Perk pills */}
        <View style={tc_s.perksRow}>
          {meta.perks.map((p, i) => (
            <View key={i} style={[tc_s.perkPill, { backgroundColor: tc.bg, borderColor: tc.border }]}>
              <Text style={[tc_s.perkText, { color: tc.text }]}>{p}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* ── Lower section ── */}
      <View style={tc_s.lower}>
        {/* Tier road */}
        <View style={tc_s.roadRow}>
          {TIERS.map((t, i) => {
            const unlocked  = TIER_ORDER[t] <= TIER_ORDER[tierKey];
            const isCurrent = t === tierKey;
            return (
              <React.Fragment key={t}>
                {i > 0 && (
                  <View style={[tc_s.roadLine, unlocked && { backgroundColor: tc.text + 'AA' }]} />
                )}
                <View style={[tc_s.roadDot, isCurrent && { borderColor: tc.text, borderWidth: 2.5 }]}>
                  <Image
                    source={TIER_IMAGES[t]}
                    style={[tc_s.roadImg, !unlocked && { opacity: 0.25 }]}
                  />
                </View>
              </React.Fragment>
            );
          })}
        </View>
        <View style={tc_s.roadLabels}>
          {TIERS.map((t) => (
            <Text
              key={t}
              style={[tc_s.roadLabel, t === tierKey && { color: tc.text, fontWeight: '800' }]}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          ))}
        </View>

        {/* Animated progress bar */}
        <View style={tc_s.progressTrack}>
          <Animated.View
            style={[tc_s.progressFill, {
              width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              backgroundColor: tc.text,
            }]}
          />
        </View>
        <View style={tc_s.progressRow}>
          <Text style={tc_s.progressHint}>
            {nextLabel && pointsToNext != null
              ? pointsToNext > 0 ? `${pointsToNext} pts to ${nextLabel}` : `${nextLabel} unlocked!`
              : 'Max tier · Eagle'}
          </Text>
          <View style={tc_s.pointsWrap}>
            <Text style={[tc_s.pointsVal, { color: tc.text }]}>{points.toLocaleString()}</Text>
            <Text style={tc_s.pointsUnit}> pts</Text>
          </View>
        </View>

        {/* Streak */}
        {streakDays != null && streakDays > 0 && (
          <View style={tc_s.streakRow}>
            <Ionicons name="flame" size={13} color={COLORS.warning} />
            <Text style={tc_s.streakText}>{streakDays}-day contribution streak</Text>
          </View>
        )}

        {/* Stats */}
        <View style={tc_s.statsRow}>
          <View style={tc_s.statCell}>
            <Text style={tc_s.statVal}>{verifiedSpots}</Text>
            <Text style={tc_s.statLbl}>Verified</Text>
          </View>
          <View style={tc_s.statDiv} />
          <View style={tc_s.statCell}>
            <Text style={tc_s.statVal}>
              {accuracy != null ? `${Math.round(accuracy * 100)}%` : '—'}
            </Text>
            <Text style={tc_s.statLbl}>Accuracy</Text>
          </View>
          <View style={tc_s.statDiv} />
          <View style={tc_s.statCell}>
            <Text style={tc_s.statVal}>{acceptedReviews}</Text>
            <Text style={tc_s.statLbl}>Reviews</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const tc_s = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  // ── Hero gradient ──
  hero: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  shimmerStripe: {
    position: 'absolute',
    top: -60,
    width: 55,
    height: 400,
    backgroundColor: 'rgba(255,255,255,0.30)',
    transform: [{ rotate: '18deg' }],
  },
  birdWrap: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  glowRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  birdImg: {
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  tierName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3.5,
    marginBottom: 3,
  },
  tierSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: 16,
  },
  perksRow: { flexDirection: 'row', gap: 8 },
  perkPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  perkText: { fontSize: 12, fontWeight: '700' },

  // ── Lower ──
  lower: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
    gap: 10,
  },

  // Tier road
  roadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  roadLine: {
    flex: 1,
    height: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: 2,
  },
  roadDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roadImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  roadLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: -2,
  },
  roadLabel: {
    width: 48,
    textAlign: 'center',
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

  // Progress
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  progressHint: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  pointsWrap: { flexDirection: 'row', alignItems: 'baseline' },
  pointsVal: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  pointsUnit: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },

  // Streak
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.warningLight,
    borderRadius: 999,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    marginTop: -2,
  },
  streakText: { fontSize: 12, fontWeight: '700', color: COLORS.warningText },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginTop: 2,
    marginBottom: 12,
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statVal: { fontSize: 17, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  statLbl: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  statDiv: { width: 1, height: 36, backgroundColor: COLORS.border },
});

// ─── My Submissions Card ──────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:    { label: 'Pending',    bg: COLORS.warningLight, text: COLORS.warningText,    icon: 'time-outline' as const },
  verified:   { label: 'Verified',   bg: COLORS.successLight, text: COLORS.success,         icon: 'checkmark-circle-outline' as const },
  rejected:   { label: 'Rejected',   bg: COLORS.dangerLight,  text: COLORS.danger,          icon: 'close-circle-outline' as const },
  superseded: { label: 'Superseded', bg: COLORS.surface,      text: COLORS.textSecondary,   icon: 'refresh-outline' as const },
};

function MySubmissionsCard({ items, loading, onContribute }: {
  items: ModerationQueueItem[];
  loading: boolean;
  onContribute: () => void;
}) {
  const MAX_SHOWN = 4;
  const shown = items.slice(0, MAX_SHOWN);

  if (loading) {
    return (
      <View style={ms.card}>
        <Text style={ms.title}>My Submissions</Text>
        {[0, 1].map((i) => (
          <View key={i} style={ms.skeletonRow}>
            <Skeleton width={160} height={13} />
            <Skeleton width={64} height={22} style={{ borderRadius: 8 }} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={ms.card}>
      <Text style={ms.title}>My Submissions</Text>
      {shown.length === 0 ? (
        <View style={ms.emptyWrap}>
          <Ionicons name="add-circle-outline" size={28} color={COLORS.textTertiary} />
          <Text style={ms.emptyText}>No submissions yet</Text>
          <Text style={ms.emptySub}>Add a parking spot to start contributing</Text>
          <TouchableOpacity style={ms.emptyBtn} onPress={onContribute} activeOpacity={0.8}>
            <Text style={ms.emptyBtnText}>Add a Spot</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {shown.map((item, i) => {
            const spot = item.payload?.spot as { name?: string; type?: string } | undefined;
            const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
            return (
              <React.Fragment key={item.id}>
                {i > 0 && <View style={ms.divider} />}
                <View style={ms.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={ms.spotName} numberOfLines={1}>{spot?.name ?? 'Unnamed spot'}</Text>
                    <Text style={ms.spotMeta} numberOfLines={1}>{spot?.type?.replace('_', ' ') ?? 'Unknown type'}</Text>
                  </View>
                  <View style={[ms.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={11} color={cfg.text} />
                    <Text style={[ms.statusText, { color: cfg.text }]}>{cfg.label}</Text>
                  </View>
                </View>
              </React.Fragment>
            );
          })}
          {items.length > MAX_SHOWN && (
            <Text style={ms.moreText}>+{items.length - MAX_SHOWN} more</Text>
          )}
        </>
      )}
    </View>
  );
}

const ms = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  emptyWrap: { alignItems: 'center', paddingVertical: 18, gap: 5 },
  emptyText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  emptySub: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyBtnText: { color: COLORS.textInverse, fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10, minHeight: 44 },
  divider: { height: 1, backgroundColor: COLORS.border },
  spotName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  spotMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexShrink: 0,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  moreText: { fontSize: 12, color: COLORS.textSecondary, paddingTop: 8, textAlign: 'center' },
});

// ─── Saved Spots ──────────────────────────────────────────────────────────────

function SavedSpotsCard({ spots, loading, onSpotPress }: {
  spots: ParkingSpot[];
  loading: boolean;
  onSpotPress: (spot: ParkingSpot) => void;
}) {
  const TYPE_LABEL: Record<string, string> = { street: 'Street', mall: 'Mall', private_lot: 'Private' };

  if (loading) {
    return (
      <View style={sv.card}>
        <Text style={sv.title}>Saved Spots</Text>
        {[0, 1, 2].map((i) => (
          <View key={i} style={sv.skeletonRow}>
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width={140} height={13} />
              <Skeleton width={80} height={11} />
            </View>
            <Skeleton width={36} height={13} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={sv.card}>
      <Text style={sv.title}>
        Saved Spots{spots.length > 0 ? ` (${spots.length})` : ''}
      </Text>
      {spots.length === 0 ? (
        <View style={sv.emptyWrap}>
          <Ionicons name="bookmark-outline" size={28} color={COLORS.textTertiary} />
          <Text style={sv.emptyText}>No saved spots yet</Text>
          <Text style={sv.emptySub}>Tap the bookmark on any spot to save it</Text>
        </View>
      ) : (
        spots.map((spot, i) => (
          <React.Fragment key={spot.id}>
            {i > 0 && <View style={sv.divider} />}
            <TouchableOpacity style={sv.row} onPress={() => onSpotPress(spot)} activeOpacity={0.7}>
              <View style={sv.spotIcon}>
                <Ionicons name="location-outline" size={15} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={sv.spotName} numberOfLines={1}>{spot.name}</Text>
                <Text style={sv.spotMeta} numberOfLines={1}>
                  {TYPE_LABEL[spot.type] ?? spot.type}{spot.rates ? `  ·  ${spot.rates}` : '  ·  Free'}
                </Text>
              </View>
              <View style={sv.mapCta}>
                <Text style={sv.mapCtaText}>Map</Text>
                <Ionicons name="chevron-forward" size={13} color={COLORS.primary} />
              </View>
            </TouchableOpacity>
          </React.Fragment>
        ))
      )}
    </View>
  );
}

const sv = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  emptyWrap: { alignItems: 'center', paddingVertical: 22, gap: 5 },
  emptyText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  emptySub: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10, minHeight: 44 },
  spotIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  divider: { height: 1, backgroundColor: COLORS.border },
  spotName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  spotMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  mapCta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  mapCtaText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

const VEHICLE_LABEL: Record<string, string> = { car: 'Car', motorcycle: 'Motorcycle', van: 'Van' };

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const { setSelectedSpot, setPendingFocusSpot } = useMapStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const statsQuery = useQuery({
    queryKey: ['contributor-stats'],
    queryFn: () => contributorsApi.me(),
  });

  const favoritesQuery = useQuery({
    queryKey: ['favorites'],
    queryFn: () => favoritesApi.list(),
  });

  const submissionsQuery = useQuery({
    queryKey: ['my-submissions'],
    queryFn: () => moderationApi.mySubmissions(),
  });

  const stats = statsQuery.data;
  const favorites: ParkingSpot[] = favoritesQuery.data ?? [];
  const submissions: ModerationQueueItem[] = submissionsQuery.data ?? [];

  async function onRefresh() {
    setRefreshing(true);
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['contributor-stats'] }),
      queryClient.invalidateQueries({ queryKey: ['favorites'] }),
      queryClient.invalidateQueries({ queryKey: ['my-submissions'] }),
    ]);
    setRefreshing(false);
  }

  function handleSpotPress(spot: ParkingSpot) {
    setSelectedSpot(spot);
    setPendingFocusSpot(spot);
    router.push('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with inline user info */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        {user && (
          <View style={styles.headerMeta}>
            <Text style={styles.headerName} numberOfLines={1}>{user.name ?? '—'}</Text>
            <View style={styles.headerRight}>
              <Text style={styles.headerEmail} numberOfLines={1}>{user.email ?? ''}</Text>
              {user.vehicleType && (
                <View style={styles.vehiclePill}>
                  <Text style={styles.vehiclePillText}>{VEHICLE_LABEL[user.vehicleType] ?? user.vehicleType}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Contributor tier */}
        {statsQuery.isLoading ? (
          <View style={styles.skeletonCard}>
            <View style={styles.skeletonTopRow}>
              <Skeleton width={80} height={28} style={{ borderRadius: 999 }} />
              <Skeleton width={60} height={22} />
            </View>
            <Skeleton width="100%" height={5} style={{ borderRadius: 3 }} />
            <Skeleton width={120} height={11} />
          </View>
        ) : (
          <TierCard
            tier={tierFromPoints(stats?.contributionPoints ?? 0)}
            points={stats?.contributionPoints ?? 0}
            accuracy={stats?.moderationAccuracy ?? null}
            verifiedSpots={stats?.verifiedPlacesCount ?? 0}
            acceptedReviews={stats?.acceptedReviewsCount ?? 0}
            streakDays={stats?.contributionStreakDays ?? null}
          />
        )}

        {/* My Submissions */}
        <MySubmissionsCard
          items={submissions}
          loading={submissionsQuery.isLoading}
          onContribute={() => router.push('/(tabs)/contribute')}
        />

        {/* Saved spots */}
        <SavedSpotsCard
          spots={favorites}
          loading={favoritesQuery.isLoading}
          onSpotPress={handleSpotPress}
        />

        {/* Footer */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.privacyText}>
          GPS data is anonymized and never linked to your account.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    gap: 6,
  },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  headerMeta: { gap: 2 },
  headerName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerEmail: { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
  vehiclePill: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  vehiclePillText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  scroll: { padding: 16, paddingBottom: 32 },
  skeletonCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    gap: 12,
  },
  skeletonTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoutBtn: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    marginBottom: 16,
  },
  logoutText: { color: COLORS.danger, fontWeight: '700', fontSize: 15 },
  privacyText: {
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 8,
  },
});
