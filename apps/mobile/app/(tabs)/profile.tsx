import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import {
  COLORS,
  TIER_COLORS,
  TIER_THRESHOLDS,
  tierProgress,
  nextTier,
  type TierName,
} from '../../constants';
import { useQuery } from '@tanstack/react-query';
import { contributorsApi, favoritesApi } from '../../services/api';
import type { ParkingSpot } from '@perch/shared';

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
      style={[
        { width, height, borderRadius: 6, backgroundColor: COLORS.border },
        { opacity },
        style,
      ]}
    />
  );
}

// ─── Tier Progress ────────────────────────────────────────────────────────────

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
  const currentThreshold = TIER_THRESHOLDS[tierKey] ?? 0;
  const pointsToNext = nextThreshold ? nextThreshold - points : null;

  const TIER_EMOJI: Record<string, string> = { pigeon: '🐦', hawk: '🦅', eagle: '🦅' };

  return (
    <View style={tc_styles.card}>
      {/* Tier badge row */}
      <View style={tc_styles.badgeRow}>
        <View style={[tc_styles.badge, { backgroundColor: tc.bg, borderColor: tc.border }]}>
          <Text style={[tc_styles.badgeTier, { color: tc.text }]}>
            {TIER_EMOJI[tierKey] ?? '🐦'}  {tierKey.toUpperCase()}
          </Text>
        </View>
        {streakDays != null && streakDays > 0 && (
          <View style={tc_styles.streakBadge}>
            <Text style={tc_styles.streakText}>🔥  {streakDays}d streak</Text>
          </View>
        )}
      </View>

      {/* Progress bar */}
      <View style={tc_styles.progressWrap}>
        <View style={tc_styles.progressTrack}>
          <View style={[tc_styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: tc.text }]} />
        </View>
        {nextLabel && pointsToNext != null && (
          <Text style={tc_styles.progressLabel}>
            {pointsToNext > 0 ? `${pointsToNext} pts to ${nextLabel}` : `${nextLabel} unlocked!`}
          </Text>
        )}
        {!nextLabel && (
          <Text style={tc_styles.progressLabel}>Max tier reached</Text>
        )}
      </View>

      {/* Stats row */}
      <View style={tc_styles.statsRow}>
        <StatCell label="Points" value={String(points)} />
        <View style={tc_styles.statDivider} />
        <StatCell
          label="Accuracy"
          value={accuracy != null ? `${Math.round(accuracy * 100)}%` : '—'}
        />
        <View style={tc_styles.statDivider} />
        <StatCell label="Verified" value={String(verifiedSpots)} />
        <View style={tc_styles.statDivider} />
        <StatCell label="Reviews" value={String(acceptedReviews)} />
      </View>
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={tc_styles.statCell}>
      <Text style={tc_styles.statValue}>{value}</Text>
      <Text style={tc_styles.statLabel}>{label}</Text>
    </View>
  );
}

const tc_styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeTier: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  streakBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  streakText: { fontSize: 12, fontWeight: '700', color: '#D97706' },
  progressWrap: { gap: 5 },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 6,
  },
  progressLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  statValue: { fontSize: 16, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  statDivider: { width: 1, height: 32, backgroundColor: COLORS.border },
});

// ─── Profile Info Card ────────────────────────────────────────────────────────

function InfoCard({ user }: { user: any }) {
  const VEHICLE_LABEL: Record<string, string> = {
    car: '🚗  Car',
    motorcycle: '🏍  Motorcycle',
    van: '🚐  Van',
  };

  return (
    <View style={ic.card}>
      <Row label="Name" value={user?.name ?? '—'} />
      <View style={ic.divider} />
      <Row label="Email" value={user?.email ?? '—'} />
      <View style={ic.divider} />
      <Row label="Vehicle" value={VEHICLE_LABEL[user?.vehicleType] ?? user?.vehicleType ?? '—'} />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={ic.row}>
      <Text style={ic.label}>{label}</Text>
      <Text style={ic.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const ic = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    gap: 16,
  },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  value: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  divider: { height: 1, backgroundColor: COLORS.border },
});

// ─── Saved Spots ──────────────────────────────────────────────────────────────

function SavedSpotsCard({ spots, loading }: { spots: ParkingSpot[]; loading: boolean }) {
  if (loading) {
    return (
      <View style={sv.card}>
        <Text style={sv.title}>Saved Spots</Text>
        {[0, 1, 2].map((i) => (
          <View key={i} style={sv.skeletonRow}>
            <Skeleton width={140} height={14} />
            <Skeleton width={60} height={12} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={sv.card}>
      <Text style={sv.title}>Saved Spots</Text>
      {spots.length === 0 ? (
        <View style={sv.emptyWrap}>
          <Text style={sv.emptyIcon}>🅿</Text>
          <Text style={sv.emptyText}>No saved spots yet</Text>
          <Text style={sv.emptySub}>Tap the bookmark on any spot to save it</Text>
        </View>
      ) : (
        spots.map((spot, i) => (
          <React.Fragment key={spot.id}>
            {i > 0 && <View style={sv.divider} />}
            <TouchableOpacity style={sv.row} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={sv.spotName} numberOfLines={1}>{spot.name}</Text>
                <Text style={sv.spotMeta} numberOfLines={1}>
                  {spot.type.replace('_', ' ')}
                  {spot.communityVerification === 'unverified' ? '  ·  Pending review' : '  ·  Verified'}
                </Text>
              </View>
              <Text style={sv.chevron}>›</Text>
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
    marginBottom: 14,
    gap: 0,
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
  emptyWrap: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyIcon: { fontSize: 32 },
  emptyText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 10,
  },
  divider: { height: 1, backgroundColor: COLORS.border },
  spotName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  spotMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  chevron: { fontSize: 20, color: COLORS.textSecondary },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const statsQuery = useQuery({
    queryKey: ['contributor-stats'],
    queryFn: () => contributorsApi.me(),
  });

  const favoritesQuery = useQuery({
    queryKey: ['favorites'],
    queryFn: () => favoritesApi.list(),
  });

  const stats = statsQuery.data;
  const favorites: ParkingSpot[] = favoritesQuery.data ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile info */}
        <InfoCard user={user} />

        {/* Contributor tier */}
        {statsQuery.isLoading ? (
          <View style={styles.skeletonCard}>
            <Skeleton width={100} height={28} style={{ marginBottom: 10 }} />
            <Skeleton width="100%" height={6} style={{ marginBottom: 6, borderRadius: 3 }} />
            <Skeleton width={140} height={12} />
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

        {/* Saved spots */}
        <SavedSpotsCard spots={favorites} loading={favoritesQuery.isLoading} />

        {/* Privacy note */}
        <View style={styles.privacyBox}>
          <Text style={styles.privacyText}>
            Your GPS data is anonymized and never linked to your account.
          </Text>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  scroll: { padding: 20 },
  skeletonCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  privacyBox: {
    backgroundColor: COLORS.infoLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.infoBorder,
  },
  privacyText: {
    fontSize: 13,
    color: COLORS.info,
    lineHeight: 18,
  },
  logoutBtn: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: { color: COLORS.danger, fontWeight: '700', fontSize: 15 },
});
