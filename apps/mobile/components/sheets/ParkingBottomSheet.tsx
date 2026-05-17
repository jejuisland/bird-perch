import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, Linking, Platform, Share, Modal,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  ParkingSpot, VehicleRate,
  calculateParkingFee, availableVehicleTypes, PricingVehicleType, FeeBreakdown,
} from '@perch/shared';
import { favoritesApi, reviewsApi } from '../../services/api';
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

// ─── Cost Calculator ─────────────────────────────────────────────────────────

const DURATION_CHIPS = [60, 120, 180, 240] as const;
const VEHICLE_OPTIONS: { type: PricingVehicleType; icon: string; label: string }[] = [
  { type: 'car', icon: '🚗', label: 'Car' },
  { type: 'motorcycle', icon: '🏍️', label: 'Moto' },
  { type: 'van', icon: '🚐', label: 'Van' },
  { type: 'truck', icon: '🚚', label: 'Truck' },
];

function formatHHMM(date: Date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

const CONFIDENCE_META: Record<string, { color: string; bg: string; label: string }> = {
  high: { color: '#16A34A', bg: '#F0FDF4', label: 'Verified rates' },
  medium: { color: COLORS.primary, bg: '#EFF6FF', label: 'Community rates' },
  low: { color: '#D97706', bg: '#FFFBEB', label: 'Unverified rates' },
  none: { color: '#6B7280', bg: '#F3F4F6', label: 'No structured rates' },
};

function TimePickerModal({
  visible,
  value,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  value: Date;
  onConfirm: (d: Date) => void;
  onClose: () => void;
}) {
  const [h, setH] = useState(value.getHours());
  const [m, setM] = useState(Math.round(value.getMinutes() / 15) * 15 % 60);

  useEffect(() => {
    if (visible) {
      setH(value.getHours());
      setM(Math.round(value.getMinutes() / 15) * 15 % 60);
    }
  }, [visible, value]);

  const adjustH = (delta: number) => setH((prev) => (prev + delta + 24) % 24);
  const adjustM = (delta: number) => setM((prev) => (prev + delta + 60) % 60);

  const formatted12 = () => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const confirm = () => {
    const d = new Date(value);
    d.setHours(h, m, 0, 0);
    onConfirm(d);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={calcStyles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={calcStyles.modalCard}>
          <Text style={calcStyles.modalTitle}>Select Arrival Time</Text>
          <View style={calcStyles.pickerRow}>
            <View style={calcStyles.pickerCol}>
              <TouchableOpacity onPress={() => adjustH(1)} style={calcStyles.pickerBtn}>
                <Text style={calcStyles.pickerArrow}>▲</Text>
              </TouchableOpacity>
              <Text style={calcStyles.pickerValue}>{(h % 12 === 0 ? 12 : h % 12).toString().padStart(2, '0')}</Text>
              <TouchableOpacity onPress={() => adjustH(-1)} style={calcStyles.pickerBtn}>
                <Text style={calcStyles.pickerArrow}>▼</Text>
              </TouchableOpacity>
            </View>
            <Text style={calcStyles.pickerColon}>:</Text>
            <View style={calcStyles.pickerCol}>
              <TouchableOpacity onPress={() => adjustM(15)} style={calcStyles.pickerBtn}>
                <Text style={calcStyles.pickerArrow}>▲</Text>
              </TouchableOpacity>
              <Text style={calcStyles.pickerValue}>{m.toString().padStart(2, '0')}</Text>
              <TouchableOpacity onPress={() => adjustM(-15)} style={calcStyles.pickerBtn}>
                <Text style={calcStyles.pickerArrow}>▼</Text>
              </TouchableOpacity>
            </View>
            <View style={calcStyles.pickerCol}>
              <TouchableOpacity onPress={() => setH((prev) => (prev + 12) % 24)} style={[calcStyles.pickerBtn, { paddingVertical: 8 }]}>
                <Text style={[calcStyles.pickerValue, { fontSize: 18 }]}>{h >= 12 ? 'PM' : 'AM'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={calcStyles.pickerPreview}>{formatted12()}</Text>
          <TouchableOpacity style={calcStyles.modalConfirmBtn} onPress={confirm} activeOpacity={0.85}>
            <Text style={calcStyles.modalConfirmText}>Set Time</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function CostCalculatorSection({ spot }: { spot: ParkingSpot }) {
  const dr = spot.detailedRates;
  const [open, setOpen] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [vehicleType, setVehicleType] = useState<PricingVehicleType>('car');
  const [arrivalTime, setArrivalTime] = useState(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    d.setMinutes(Math.round(d.getMinutes() / 15) * 15);
    return d;
  });
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [customMinutes, setCustomMinutes] = useState('');
  const [customActive, setCustomActive] = useState(false);

  const availableTypes = useMemo(() => (dr ? availableVehicleTypes(dr) : []), [dr]);

  useEffect(() => {
    if (availableTypes.length > 0 && !availableTypes.includes(vehicleType)) {
      setVehicleType(availableTypes[0]);
    }
  }, [availableTypes]);

  const effectiveDuration = customActive
    ? Math.max(1, parseInt(customMinutes || '0', 10))
    : durationMinutes;

  const breakdown: FeeBreakdown | null = useMemo(() => {
    if (!dr) return null;
    const rates = dr[vehicleType];
    if (!rates) {
      const fallback = dr.car ?? dr.motorcycle ?? dr.van ?? dr.truck;
      if (!fallback) return null;
      const result = calculateParkingFee({
        arrivalTime,
        exitTime: new Date(arrivalTime.getTime() + effectiveDuration * 60_000),
        vehicleType,
        rates: fallback,
        detailedRates: dr,
      });
      result.warnings.unshift(`No ${vehicleType} rate — using ${dr.car ? 'car' : 'available'} rate`);
      return result;
    }
    return calculateParkingFee({
      arrivalTime,
      exitTime: new Date(arrivalTime.getTime() + effectiveDuration * 60_000),
      vehicleType,
      rates,
      detailedRates: dr,
    });
  }, [dr, vehicleType, arrivalTime, effectiveDuration]);

  const confidence = breakdown?.confidence ?? 'none';
  const meta = CONFIDENCE_META[confidence] ?? CONFIDENCE_META.none;

  if (!dr) {
    return (
      <View style={calcStyles.noRatesCard}>
        <Text style={calcStyles.noRatesText}>
          💡 No structured rates — see rates summary below for pricing info.
        </Text>
      </View>
    );
  }

  return (
    <View style={calcStyles.container}>
      <TouchableOpacity style={calcStyles.header} onPress={() => setOpen((v) => !v)} activeOpacity={0.7}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={calcStyles.headerIcon}>🧮</Text>
          <Text style={calcStyles.headerTitle}>Calculate My Cost</Text>
        </View>
        <Text style={calcStyles.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={calcStyles.body}>
          {/* Vehicle selector */}
          <Text style={calcStyles.inputLabel}>VEHICLE</Text>
          <View style={calcStyles.vehicleTabs}>
            {VEHICLE_OPTIONS.filter((v) => availableTypes.includes(v.type)).map((v) => (
              <TouchableOpacity
                key={v.type}
                style={[calcStyles.vehicleTab, vehicleType === v.type && calcStyles.vehicleTabActive]}
                onPress={() => setVehicleType(v.type)}
                activeOpacity={0.7}
              >
                <Text style={calcStyles.vehicleTabIcon}>{v.icon}</Text>
                <Text style={[calcStyles.vehicleTabLabel, vehicleType === v.type && calcStyles.vehicleTabLabelActive]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Arrival time */}
          <Text style={[calcStyles.inputLabel, { marginTop: 14 }]}>ARRIVAL TIME</Text>
          <View style={calcStyles.arrivalRow}>
            <TouchableOpacity
              style={calcStyles.timeAdjBtn}
              onPress={() => setArrivalTime((d) => new Date(d.getTime() - 30 * 60_000))}
              activeOpacity={0.7}
            >
              <Text style={calcStyles.timeAdjText}>−30m</Text>
            </TouchableOpacity>
            <TouchableOpacity style={calcStyles.timeDisplay} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
              <Text style={calcStyles.timeDisplayText}>{formatHHMM(arrivalTime)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={calcStyles.timeAdjBtn}
              onPress={() => setArrivalTime((d) => new Date(d.getTime() + 30 * 60_000))}
              activeOpacity={0.7}
            >
              <Text style={calcStyles.timeAdjText}>+30m</Text>
            </TouchableOpacity>
          </View>

          {/* Duration chips */}
          <Text style={[calcStyles.inputLabel, { marginTop: 14 }]}>STAY DURATION</Text>
          <View style={calcStyles.durationRow}>
            {DURATION_CHIPS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[calcStyles.durationChip, !customActive && durationMinutes === d && calcStyles.durationChipActive]}
                onPress={() => { setDurationMinutes(d); setCustomActive(false); }}
                activeOpacity={0.7}
              >
                <Text style={[calcStyles.durationChipText, !customActive && durationMinutes === d && calcStyles.durationChipTextActive]}>
                  {formatDuration(d)}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[calcStyles.durationChip, customActive && calcStyles.durationChipActive]}
              onPress={() => setCustomActive(true)}
              activeOpacity={0.7}
            >
              <Text style={[calcStyles.durationChipText, customActive && calcStyles.durationChipTextActive]}>Custom</Text>
            </TouchableOpacity>
          </View>
          {customActive && (
            <View style={calcStyles.customRow}>
              <TextInput
                style={calcStyles.customInput}
                placeholder="Hours (e.g. 5)"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="numeric"
                value={customMinutes}
                onChangeText={(v) => setCustomMinutes(v.replace(/[^0-9.]/g, ''))}
              />
              <Text style={calcStyles.customUnit}>hours</Text>
              <TouchableOpacity
                style={calcStyles.customSetBtn}
                onPress={() => {
                  const hrs = parseFloat(customMinutes || '0');
                  setDurationMinutes(Math.round(hrs * 60));
                  setCustomActive(false);
                  setCustomMinutes('');
                }}
                activeOpacity={0.7}
              >
                <Text style={calcStyles.customSetText}>Set</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Breakdown */}
          {breakdown && (
            <View style={calcStyles.breakdownCard}>
              <View style={calcStyles.breakdownDivider} />
              {breakdown.lineItems.map((item, i) => (
                <View key={i} style={calcStyles.lineItemRow}>
                  <Text style={calcStyles.lineItemLabel}>{item.label}</Text>
                  <Text style={[calcStyles.lineItemAmount, item.isFree && calcStyles.lineItemFree]}>
                    {item.isFree ? 'FREE' : item.amount < 0 ? `−₱${Math.abs(item.amount).toLocaleString()}` : `₱${item.amount.toLocaleString()}`}
                  </Text>
                </View>
              ))}
              <View style={calcStyles.totalRow}>
                <View style={calcStyles.breakdownDivider} />
                {breakdown.cap !== undefined && (
                  <View style={calcStyles.capRow}>
                    <Text style={calcStyles.capLabel}>🔒 Daily max cap applied</Text>
                    <Text style={calcStyles.capValue}>₱{breakdown.cap.toLocaleString()}</Text>
                  </View>
                )}
                <View style={calcStyles.totalAmountRow}>
                  <Text style={calcStyles.totalLabel}>ESTIMATED TOTAL</Text>
                  <Text style={calcStyles.totalAmount}>₱{breakdown.total.toLocaleString()}</Text>
                </View>
                <Text style={calcStyles.exitNote}>
                  Exit by {formatHHMM(new Date(arrivalTime.getTime() + effectiveDuration * 60_000))}
                </Text>
              </View>
              {breakdown.warnings.map((w, i) => (
                <Text key={i} style={calcStyles.warning}>⚠ {w}</Text>
              ))}
              <View style={[calcStyles.confidenceBadge, { backgroundColor: meta.bg }]}>
                <Text style={[calcStyles.confidenceText, { color: meta.color }]}>
                  {meta.label} · {confidence === 'high' ? '✓ Verified' : confidence === 'medium' ? 'Moderate confidence' : 'Use as rough estimate'}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      <TimePickerModal
        visible={showTimePicker}
        value={arrivalTime}
        onConfirm={setArrivalTime}
        onClose={() => setShowTimePicker(false)}
      />
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
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    if (!spot) {
      setIsSaved(false);
      return;
    }
    favoritesApi
      .list()
      .then((spots) => {
        if (cancelled) return;
        setIsSaved(spots.some((s) => s.id === spot.id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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
              {spot.communityVerification === 'unverified' ? (
                <View style={styles.unverifiedChip}>
                  <Text style={styles.unverifiedChipText}>Unverified</Text>
                </View>
              ) : null}
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
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={async () => {
                  if (!spot || saving) return;
                  setSaving(true);
                  try {
                    if (isSaved) {
                      await favoritesApi.remove(spot.id);
                      setIsSaved(false);
                    } else {
                      await favoritesApi.add(spot.id);
                      setIsSaved(true);
                    }
                  } finally {
                    setSaving(false);
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.saveBtnIcon}>{isSaved ? '♥' : '♡'}</Text>
                <Text style={styles.saveBtnText}>{isSaved ? 'Saved' : 'Save'}</Text>
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

            {/* ── Cost Calculator ── */}
            <CostCalculatorSection spot={spot} />

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
  unverifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  unverifiedChipText: { fontSize: 12, fontWeight: '700', color: '#374151' },
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
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 6,
    backgroundColor: '#fff',
  },
  saveBtnIcon: { fontSize: 16, color: COLORS.text, fontWeight: '800' },
  saveBtnText: { color: COLORS.text, fontWeight: '600', fontSize: 15 },

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

// ─── Cost calculator styles ───────────────────────────────────────────────────

const calcStyles = StyleSheet.create({
  container: {
    borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
    marginBottom: 16, overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F0FDF4', paddingHorizontal: 16, paddingVertical: 14,
  },
  headerIcon: { fontSize: 16 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#166534' },
  chevron: { fontSize: 12, color: '#166534', fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },

  inputLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.8, marginBottom: 8 },

  vehicleTabs: { flexDirection: 'row', gap: 8 },
  vehicleTab: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  vehicleTabActive: { borderColor: COLORS.primary, backgroundColor: '#EFF6FF' },
  vehicleTabIcon: { fontSize: 18, marginBottom: 2 },
  vehicleTabLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  vehicleTabLabelActive: { color: COLORS.primary },

  arrivalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeAdjBtn: {
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  timeAdjText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  timeDisplay: {
    flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 10,
    backgroundColor: COLORS.primary + '15', borderWidth: 1.5, borderColor: COLORS.primary,
  },
  timeDisplayText: { fontSize: 16, fontWeight: '800', color: COLORS.primary },

  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
  },
  durationChipActive: { borderColor: COLORS.primary, backgroundColor: '#EFF6FF' },
  durationChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  durationChipTextActive: { color: COLORS.primary },

  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  customInput: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  customUnit: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  customSetBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  customSetText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  breakdownCard: { marginTop: 14 },
  breakdownDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  lineItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  lineItemLabel: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  lineItemAmount: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  lineItemFree: { color: '#16A34A' },

  totalRow: { marginTop: 2 },
  capRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFF7ED', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6,
  },
  capLabel: { fontSize: 12, color: '#92400E' },
  capValue: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  totalAmountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  totalLabel: { fontSize: 13, fontWeight: '800', color: COLORS.text, letterSpacing: 0.4 },
  totalAmount: { fontSize: 22, fontWeight: '900', color: COLORS.primary },
  exitNote: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'right', marginTop: 2, marginBottom: 8 },

  warning: { fontSize: 12, color: '#D97706', marginBottom: 6, lineHeight: 17 },
  confidenceBadge: {
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginTop: 4,
  },
  confidenceText: { fontSize: 12, fontWeight: '600' },

  noRatesCard: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 16,
  },
  noRatesText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },

  // Time picker modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    width: 280, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: 20 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  pickerCol: { alignItems: 'center', minWidth: 56 },
  pickerBtn: { padding: 10 },
  pickerArrow: { fontSize: 18, color: COLORS.primary, fontWeight: '700' },
  pickerValue: { fontSize: 32, fontWeight: '900', color: COLORS.text, minWidth: 52, textAlign: 'center' },
  pickerColon: { fontSize: 32, fontWeight: '900', color: COLORS.text, marginBottom: 4 },
  pickerPreview: { fontSize: 15, color: COLORS.textSecondary, marginBottom: 20 },
  modalConfirmBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingHorizontal: 32, paddingVertical: 13, width: '100%', alignItems: 'center',
  },
  modalConfirmText: { color: '#fff', fontWeight: '700', fontSize: 16 },
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
