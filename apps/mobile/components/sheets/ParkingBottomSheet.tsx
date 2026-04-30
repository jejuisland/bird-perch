import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, Linking, Platform, Share,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { ParkingSpot, VehicleRate } from '@perch/shared';
import { reviewsApi } from '../../services/api';
import { COLORS } from '../../constants';

interface Props {
  spot: ParkingSpot | null;
  userLocation: { latitude: number; longitude: number } | null;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

function formatMinutes(min: number) {
  if (min < 1) return '< 1 min';
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function getHighlights(spot: ParkingSpot): { icon: string; label: string }[] {
  const tags: { icon: string; label: string }[] = [];
  if (spot.type === 'mall') tags.push({ icon: '🏢', label: 'Covered' });
  if (spot.type === 'private_lot') tags.push({ icon: '🔒', label: 'Secured' });
  if (spot.type === 'street') tags.push({ icon: '🛣️', label: 'Open Air' });
  if ((spot.operatingHours ?? '').toLowerCase().includes('24')) tags.push({ icon: '🕐', label: '24 Hours' });
  if (spot.status === 'usually_available') tags.push({ icon: '✅', label: 'Often Free' });
  if (spot.status === 'usually_busy') tags.push({ icon: '🔴', label: 'Often Full' });
  if (Number(spot.averageRating ?? 0) >= 4.5) tags.push({ icon: '⭐', label: 'Top Rated' });
  if (spot.reviewCount >= 5) tags.push({ icon: '💬', label: 'Popular' });
  if (spot.totalSlots && spot.totalSlots >= 1000) tags.push({ icon: '🅿️', label: 'Large Lot' });
  return tags;
}

const FACILITY_ICONS: Record<string, string> = {
  'CCTV': '📹',
  'Security Guard': '👮',
  'Covered': '🏠',
  'EV Charging': '⚡',
  'Accessible Parking': '♿',
  'Car Wash': '🚿',
  'Gated': '🔒',
  'Valet Parking': '🎫',
  '24/7 Attendant': '🧑‍💼',
};

const TYPE_LABEL: Record<string, string> = { street: 'Street', mall: 'Mall', private_lot: 'Private' };

const STATUS_COLOR: Record<string, string> = {
  usually_available: '#16A34A',
  usually_busy: '#DC2626',
  unknown: '#9CA3AF',
};
const STATUS_LABEL: Record<string, string> = {
  usually_available: 'Usually Free',
  usually_busy: 'Usually Full',
  unknown: 'Unknown',
};

function peso(amount: number) {
  return `₱${amount.toLocaleString()}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StarRating({ rating, size = 16, onRate }: { rating: number; size?: number; onRate?: (r: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <TouchableOpacity key={s} onPress={() => onRate?.(s)} disabled={!onRate} activeOpacity={0.7}>
          <Text style={{ fontSize: size, color: s <= rating ? COLORS.star : COLORS.border }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function RouteCard({ distance }: { distance: number }) {
  const walkMin = (distance / 5) * 60;
  const driveMin = (distance / 20) * 60;
  return (
    <View style={routeStyles.card}>
      <View style={routeStyles.row}>
        <View style={routeStyles.item}>
          <Text style={routeStyles.icon}>🚶</Text>
          <View>
            <Text style={routeStyles.value}>{formatMinutes(walkMin)}</Text>
            <Text style={routeStyles.label}>Walking</Text>
          </View>
        </View>
        <View style={routeStyles.divider} />
        <View style={routeStyles.item}>
          <Text style={routeStyles.icon}>🚗</Text>
          <View>
            <Text style={routeStyles.value}>{formatMinutes(driveMin)}</Text>
            <Text style={routeStyles.label}>By car</Text>
          </View>
        </View>
        <View style={routeStyles.divider} />
        <View style={routeStyles.item}>
          <Text style={routeStyles.icon}>📍</Text>
          <View>
            <Text style={routeStyles.value}>{formatDistance(distance)}</Text>
            <Text style={routeStyles.label}>Distance</Text>
          </View>
        </View>
      </View>
      <Text style={routeStyles.note}>Drive time estimated for Metro Manila traffic</Text>
    </View>
  );
}

function VehicleRateRow({ icon, label, rate }: { icon: string; label: string; rate: VehicleRate }) {
  return (
    <View style={rateStyles.vehicleBlock}>
      <View style={rateStyles.vehicleHeader}>
        <Text style={rateStyles.vehicleIcon}>{icon}</Text>
        <Text style={rateStyles.vehicleLabel}>{label}</Text>
      </View>
      {rate.freeMinutes ? (
        <View style={rateStyles.rateRow}>
          <Text style={rateStyles.rateLabel}>Free grace period</Text>
          <Text style={rateStyles.rateValue}>{rate.freeMinutes} minutes</Text>
        </View>
      ) : null}
      {rate.firstHours && rate.firstRate ? (
        <View style={rateStyles.rateRow}>
          <Text style={rateStyles.rateLabel}>First {rate.firstHours} hour{rate.firstHours > 1 ? 's' : ''}</Text>
          <Text style={rateStyles.rateValue}>{peso(rate.firstRate)}</Text>
        </View>
      ) : null}
      {rate.succeedingRate ? (
        <View style={rateStyles.rateRow}>
          <Text style={rateStyles.rateLabel}>Succeeding rate</Text>
          <Text style={rateStyles.rateValue}>{peso(rate.succeedingRate)}/hr</Text>
        </View>
      ) : null}
      {rate.flatRate ? (
        <View style={rateStyles.rateRow}>
          <Text style={rateStyles.rateLabel}>Flat rate{rate.flatRateWindow ? ` (${rate.flatRateWindow})` : ''}</Text>
          <Text style={rateStyles.rateValue}>{peso(rate.flatRate)}</Text>
        </View>
      ) : null}
      {rate.overnightCharge ? (
        <View style={[rateStyles.rateRow, rateStyles.overnightRow]}>
          <Text style={rateStyles.overnightLabel}>🌙 Overnight {rate.overnightCutoff ?? ''}</Text>
          <Text style={rateStyles.overnightValue}>+{peso(rate.overnightCharge)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function DetailedRatesSection({ spot }: { spot: ParkingSpot }) {
  const [expanded, setExpanded] = useState(true);
  const dr = spot.detailedRates;
  if (!dr) return null;

  return (
    <View style={rateStyles.container}>
      <TouchableOpacity style={rateStyles.header} onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
        <Text style={rateStyles.headerTitle}>Parking Rates</Text>
        <Text style={rateStyles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={rateStyles.body}>
          {dr.car && <VehicleRateRow icon="🚗" label="Four-Wheeler / Car" rate={dr.car} />}
          {dr.motorcycle && (
            <>
              {dr.car && <View style={rateStyles.vehicleDivider} />}
              <VehicleRateRow icon="🏍️" label="Motorcycle" rate={dr.motorcycle} />
            </>
          )}
          {dr.van && (
            <>
              <View style={rateStyles.vehicleDivider} />
              <VehicleRateRow icon="🚐" label="Van / AUV" rate={dr.van} />
            </>
          )}
          {dr.lostTicketFee ? (
            <View style={rateStyles.lostTicketRow}>
              <Text style={rateStyles.lostTicketLabel}>⚠️  Lost ticket fee</Text>
              <Text style={rateStyles.lostTicketValue}>{peso(dr.lostTicketFee)}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

function CarParkConditions({ rules }: { rules: string[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={condStyles.container}>
      <TouchableOpacity style={condStyles.header} onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
        <View style={condStyles.headerLeft}>
          <Text style={condStyles.headerIcon}>📋</Text>
          <Text style={condStyles.headerTitle}>Car Park Conditions</Text>
        </View>
        <Text style={condStyles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={condStyles.body}>
          {rules.map((rule, i) => (
            <View key={i} style={condStyles.ruleRow}>
              <Text style={condStyles.ruleNumber}>{i + 1}.</Text>
              <Text style={condStyles.ruleText}>{rule}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function FacilitiesRow({ facilities }: { facilities: string[] }) {
  if (!facilities.length) return null;
  return (
    <View style={styles.facilitiesContainer}>
      <Text style={styles.facilitiesTitle}>Facilities</Text>
      <View style={styles.facilitiesRow}>
        {facilities.map((f) => (
          <View key={f} style={styles.facilityChip}>
            <Text style={styles.facilityIcon}>{FACILITY_ICONS[f] ?? '•'}</Text>
            <Text style={styles.facilityLabel}>{f}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function InlineAd() {
  return (
    <View style={adStyles.container}>
      <Text style={adStyles.sectionHeader}>Check out before parking</Text>
      <TouchableOpacity style={adStyles.card} activeOpacity={0.9}>
        <View style={adStyles.imageBg}>
          <Text style={adStyles.imageEmoji}>🚗✨</Text>
          <Text style={adStyles.imageCopy}>Get your car washed{'\n'}while you're parked!</Text>
        </View>
        <View style={adStyles.footer}>
          <View style={{ flex: 1 }}>
            <Text style={adStyles.adTitle}>SparkleClean BGC</Text>
            <Text style={adStyles.adMeta}>Ad · SparkleClean Inc.</Text>
          </View>
          <Text style={adStyles.learnMore}>Learn more →</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ParkingBottomSheet({ spot, userLocation, onClose }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['45%', '90%'], []);

  const [reviews, setReviews] = useState<any[]>([]);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (spot) {
      sheetRef.current?.snapToIndex(0);
      setNewRating(0);
      setNewComment('');
      setReviews([]);
      reviewsApi.getBySpot(spot.id).then(setReviews).catch(() => {});
    } else {
      sheetRef.current?.close();
    }
  }, [spot?.id]);

  const distance = useMemo(() => {
    if (!spot || !userLocation) return null;
    return haversineKm(userLocation.latitude, userLocation.longitude, spot.latitude, spot.longitude);
  }, [spot, userLocation]);

  const highlights = useMemo(() => (spot ? getHighlights(spot) : []), [spot]);

  const handleNavigate = useCallback(() => {
    if (!spot) return;
    const { latitude, longitude, name } = spot;
    const label = encodeURIComponent(name);
    const url =
      Platform.OS === 'ios'
        ? `maps://?daddr=${latitude},${longitude}&q=${label}`
        : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/maps?daddr=${latitude},${longitude}`)
    );
  }, [spot]);

  const handleShare = useCallback(() => {
    if (!spot) return;
    const dist = distance !== null ? ` · ${formatDistance(distance)} away` : '';
    Share.share({
      title: spot.name,
      message:
        `🅿️ ${spot.name}${dist}\n` +
        `📍 ${spot.address || TYPE_LABEL[spot.type]}\n` +
        `💰 ${spot.rates || 'Rate not listed'}\n` +
        `⏰ ${spot.operatingHours || 'Hours not listed'}\n` +
        `⭐ ${Number(spot.averageRating ?? 0) > 0 ? Number(spot.averageRating).toFixed(1) : 'No ratings'}/5\n\n` +
        `Shared via Perch`,
    });
  }, [spot, distance]);

  const handleSubmitReview = async () => {
    if (!spot || newRating === 0) return Alert.alert('Select a rating', 'Tap a star before submitting.');
    setSubmitting(true);
    try {
      await reviewsApi.create(spot.id, { rating: newRating, comment: newComment });
      setNewRating(0);
      setNewComment('');
      const updated = await reviewsApi.getBySpot(spot.id);
      setReviews(updated);
    } catch {
      Alert.alert('Error', 'Failed to submit review. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={snapPoints}
      index={-1}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {spot ? (
          <>
            {/* ── Header ── */}
            <Text style={styles.spotName} numberOfLines={2}>{spot.name}</Text>
            <View style={styles.chipsRow}>
              <View style={styles.typeChip}>
                <Text style={styles.typeChipText}>{TYPE_LABEL[spot.type]}</Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: STATUS_COLOR[spot.status] + '1A' }]}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[spot.status] }]} />
                <Text style={[styles.statusChipText, { color: STATUS_COLOR[spot.status] }]}>
                  {STATUS_LABEL[spot.status]}
                </Text>
              </View>
              {spot.totalSlots ? (
                <View style={styles.slotsChip}>
                  <Text style={styles.slotsText}>🅿️ {spot.totalSlots.toLocaleString()} slots</Text>
                </View>
              ) : null}
            </View>

            {/* ── Rating ── */}
            <View style={styles.ratingRow}>
              <StarRating rating={Math.round(Number(spot.averageRating ?? 0))} />
              <Text style={styles.ratingMeta}>
                {Number(spot.averageRating ?? 0) > 0 ? Number(spot.averageRating).toFixed(1) : 'No ratings'}
                {'  ·  '}
                {spot.reviewCount} review{spot.reviewCount !== 1 ? 's' : ''}
              </Text>
            </View>

            {/* ── Actions ── */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.navigateBtn} onPress={handleNavigate} activeOpacity={0.85}>
                <Text style={styles.btnIcon}>🗺️</Text>
                <Text style={styles.navigateBtnText}>Navigate</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
                <Text style={styles.shareBtnIcon}>⬆</Text>
                <Text style={styles.shareBtnText}>Share</Text>
              </TouchableOpacity>
            </View>

            {/* ── Route Card ── */}
            {distance !== null && <RouteCard distance={distance} />}

            {/* ── Highlights ── */}
            {highlights.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.highlightsScroll}
                contentContainerStyle={styles.highlightsContent}
              >
                {highlights.map((h, i) => (
                  <View key={i} style={styles.highlightChip}>
                    <Text style={styles.highlightIcon}>{h.icon}</Text>
                    <Text style={styles.highlightLabel}>{h.label}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* ── Facilities ── */}
            {spot.facilities && spot.facilities.length > 0 && (
              <FacilitiesRow facilities={spot.facilities} />
            )}

            {/* ── Detailed Rates ── */}
            {spot.detailedRates && <DetailedRatesSection spot={spot} />}

            {/* ── Info Card ── */}
            <View style={styles.detailsCard}>
              {spot.address ? (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailEmoji}>📍</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailLabel}>ADDRESS</Text>
                      <Text style={styles.detailValue}>{spot.address}</Text>
                    </View>
                  </View>
                  <View style={styles.detailDivider} />
                </>
              ) : null}
              <View style={styles.detailRow}>
                <Text style={styles.detailEmoji}>💰</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailLabel}>RATES SUMMARY</Text>
                  <Text style={styles.detailValue}>{spot.rates || 'Not specified'}</Text>
                </View>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailEmoji}>🕐</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailLabel}>OPERATING HOURS</Text>
                  <Text style={styles.detailValue}>{spot.operatingHours || 'Not specified'}</Text>
                </View>
              </View>
              {spot.contactNumber ? (
                <>
                  <View style={styles.detailDivider} />
                  <TouchableOpacity
                    style={styles.detailRow}
                    onPress={() => Linking.openURL(`tel:${spot.contactNumber}`)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.detailEmoji}>📞</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailLabel}>CONTACT</Text>
                      <Text style={[styles.detailValue, { color: COLORS.primary }]}>{spot.contactNumber}</Text>
                    </View>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>

            {/* ── Car Park Conditions ── */}
            {spot.rules && spot.rules.length > 0 && (
              <CarParkConditions rules={spot.rules} />
            )}

            {/* ── Ad ── */}
            <InlineAd />

            {/* ── Leave a Review ── */}
            <Text style={styles.sectionTitle}>Leave a Review</Text>
            <View style={styles.starPickerRow}>
              <StarRating rating={newRating} size={32} onRate={setNewRating} />
              {newRating > 0 && (
                <Text style={styles.starHint}>
                  {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][newRating]}
                </Text>
              )}
            </View>
            <TextInput
              style={styles.commentInput}
              placeholder="Share your experience (optional)"
              placeholderTextColor={COLORS.textSecondary}
              value={newComment}
              onChangeText={setNewComment}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.submitBtn, newRating === 0 && styles.submitBtnDisabled]}
              onPress={handleSubmitReview}
              disabled={submitting || newRating === 0}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.submitText}>Submit Review</Text>}
            </TouchableOpacity>

            {/* ── Reviews ── */}
            {reviews.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
                  Reviews ({reviews.length})
                </Text>
                {reviews.map((r) => (
                  <View key={r.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <View style={styles.reviewAvatar}>
                        <Text style={styles.reviewAvatarLetter}>
                          {(r.user?.name ?? 'A')[0].toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reviewerName}>{r.user?.name ?? 'Anonymous'}</Text>
                        <StarRating rating={r.rating} />
                      </View>
                      <Text style={styles.reviewDate}>
                        {new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                    {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
                  </View>
                ))}
              </>
            )}
          </>
        ) : null}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  handle: { backgroundColor: '#D1D5DB', width: 44, height: 4, borderRadius: 2 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 64 },

  spotName: { fontSize: 21, fontWeight: '800', color: COLORS.text, marginBottom: 10 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  typeChip: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  typeChipText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusChipText: { fontSize: 12, fontWeight: '600' },
  slotsChip: { backgroundColor: COLORS.surface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  slotsText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  ratingMeta: { fontSize: 13, color: COLORS.textSecondary },

  actions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  navigateBtn: {
    flex: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, gap: 8,
  },
  btnIcon: { fontSize: 18 },
  navigateBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, paddingVertical: 14, gap: 6,
  },
  shareBtnIcon: { fontSize: 16, color: COLORS.text, fontWeight: '700' },
  shareBtnText: { color: COLORS.text, fontWeight: '600', fontSize: 15 },

  highlightsScroll: { marginBottom: 16 },
  highlightsContent: { gap: 8 },
  highlightChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.surface, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  highlightIcon: { fontSize: 15 },
  highlightLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text },

  facilitiesContainer: { marginBottom: 20 },
  facilitiesTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  facilitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  facilityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.surface, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  facilityIcon: { fontSize: 14 },
  facilityLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text },

  detailsCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailEmoji: { fontSize: 20, marginTop: 2 },
  detailLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.8, marginBottom: 3 },
  detailValue: { fontSize: 14, color: COLORS.text, fontWeight: '500', lineHeight: 20 },
  detailDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  starPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  starHint: { fontSize: 14, color: COLORS.textSecondary, fontStyle: 'italic' },
  commentInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    padding: 14, minHeight: 80, fontSize: 14, color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12, padding: 15,
    alignItems: 'center', marginTop: 12, marginBottom: 24,
  },
  submitBtnDisabled: { backgroundColor: '#93C5FD' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  reviewCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 10 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  reviewAvatarLetter: { fontSize: 17, fontWeight: '800', color: COLORS.primary },
  reviewerName: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  reviewComment: { fontSize: 14, color: COLORS.text, lineHeight: 21 },
  reviewDate: { fontSize: 11, color: COLORS.textSecondary },
});

// ─── Route card styles ────────────────────────────────────────────────────────

const routeStyles = StyleSheet.create({
  card: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  item: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { fontSize: 22 },
  value: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  label: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  divider: { width: 1, height: 32, backgroundColor: '#BFDBFE', marginHorizontal: 4 },
  note: { fontSize: 11, color: COLORS.textSecondary, marginTop: 10, textAlign: 'center' },
});

// ─── Detailed rates styles ────────────────────────────────────────────────────

const rateStyles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  chevron: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingVertical: 12 },

  vehicleBlock: { paddingVertical: 4 },
  vehicleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  vehicleIcon: { fontSize: 18 },
  vehicleLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },

  rateRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rateLabel: { fontSize: 13, color: COLORS.textSecondary },
  rateValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },

  overnightRow: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  overnightLabel: { fontSize: 12, color: '#92400E', flex: 1 },
  overnightValue: { fontSize: 12, fontWeight: '700', color: '#DC2626' },

  vehicleDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },

  lostTicketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  lostTicketLabel: { fontSize: 13, color: COLORS.textSecondary },
  lostTicketValue: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
});

// ─── Conditions styles ────────────────────────────────────────────────────────

const condStyles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { fontSize: 16 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#78350F' },
  chevron: { fontSize: 12, color: '#92400E', fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingVertical: 12 },
  ruleRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  ruleNumber: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, minWidth: 18 },
  ruleText: { fontSize: 13, color: COLORS.text, lineHeight: 20, flex: 1 },
});

// ─── Inline ad styles ─────────────────────────────────────────────────────────

const adStyles = StyleSheet.create({
  container: { marginBottom: 24 },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  card: {
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  imageBg: {
    height: 110,
    backgroundColor: '#1E3A8A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  imageEmoji: { fontSize: 32 },
  imageCopy: { fontSize: 13, color: '#BFDBFE', textAlign: 'center', lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  adTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  adMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  learnMore: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
});
