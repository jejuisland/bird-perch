import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useMapStore } from '../../store/mapStore';
import {
  COLORS,
  TIER_COLORS,
  TIER_THRESHOLDS,
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
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: 6, backgroundColor: COLORS.border }, { opacity }, style]}
    />
  );
}

// ─── Tier Card ────────────────────────────────────────────────────────────────

function TierCard({ tier, points, accuracy, verifiedSpots, acceptedReviews, streakDays }: {
  tier: string;
  points: number;
  accuracy: number | null;
  verifiedSpots: number;
  acceptedReviews: number;
  streakDays: number | null;
}) {
  const tierKey = (tier ?? 'pigeon') as TierName;
  const tc = TIER_COLORS[tierKey] ?? TIER_COLORS.pigeon;
  const next = nextTier(tierKey);
  const progress = tierProgress(points, tierKey);
  const nextLabel = next ? next.charAt(0).toUpperCase() + next.slice(1) : null;
  const nextThreshold = next ? TIER_THRESHOLDS[next] : null;
  const pointsToNext = nextThreshold ? nextThreshold - points : null;

  return (
    <View style={tc_s.card}>
      {/* Badge row: tier pill (left) + points (right) */}
      <View style={tc_s.topRow}>
        <View style={[tc_s.badge, { backgroundColor: tc.bg, borderColor: tc.border }]}>
          <Text style={[tc_s.badgeText, { color: tc.text }]}>{tierKey.toUpperCase()}</Text>
        </View>
        <View style={tc_s.pointsWrap}>
          <Text style={tc_s.pointsNum}>{points.toLocaleString()}</Text>
          <Text style={tc_s.pointsLabel}>pts</Text>
        </View>
      </View>

      {/* Progress */}
      <View style={tc_s.progressSection}>
        <View style={tc_s.progressTrack}>
          <View style={[tc_s.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: tc.text }]} />
        </View>
        <View style={tc_s.progressMeta}>
          {nextLabel && pointsToNext != null ? (
            <Text style={tc_s.progressLabel}>
              {pointsToNext > 0 ? `${pointsToNext} pts to ${nextLabel}` : `${nextLabel} unlocked!`}
            </Text>
          ) : (
            <Text style={tc_s.progressLabel}>Max tier · Eagle</Text>
          )}
          {streakDays != null && streakDays > 0 && (
            <View style={tc_s.streakPill}>
              <Ionicons name="flame" size={11} color={COLORS.warning} />
              <Text style={tc_s.streakText}>{streakDays}d</Text>
            </View>
          )}
        </View>
      </View>

      {/* 3-stat row */}
      <View style={tc_s.statsRow}>
        <View style={tc_s.statCell}>
          <Text style={tc_s.statValue}>{verifiedSpots}</Text>
          <Text style={tc_s.statLabel}>Verified</Text>
        </View>
        <View style={tc_s.statDivider} />
        <View style={tc_s.statCell}>
          <Text style={tc_s.statValue}>
            {accuracy != null ? `${Math.round(accuracy * 100)}%` : '—'}
          </Text>
          <Text style={tc_s.statLabel}>Accuracy</Text>
        </View>
        <View style={tc_s.statDivider} />
        <View style={tc_s.statCell}>
          <Text style={tc_s.statValue}>{acceptedReviews}</Text>
          <Text style={tc_s.statLabel}>Reviews</Text>
        </View>
      </View>
    </View>
  );
}

const tc_s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  pointsWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  pointsNum: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  pointsLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  progressSection: { gap: 6 },
  progressTrack: { height: 5, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, minWidth: 4 },
  progressMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.warningLight,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  streakText: { fontSize: 11, fontWeight: '700', color: COLORS.warningText },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  statValue: { fontSize: 17, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  statDivider: { width: 1, height: 36, backgroundColor: COLORS.border },
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
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
            tier={stats?.tier ?? 'pigeon'}
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
    borderColor: '#FECACA',
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
