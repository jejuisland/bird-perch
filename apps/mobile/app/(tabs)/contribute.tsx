import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Modal,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { COLORS, OSM_TILE_URL } from '../../constants';
import { useLocation } from '../../hooks/useLocation';
import {
  communityParkingApi,
  moderationApi,
  uploadsApi,
  parkingApi,
  type ModerationQueuePage,
} from '../../services/api';
import type { ParkingType, ParkingSpot, ModerationQueueItem, DetailedRates, VehicleRate } from '@perch/shared';
function genId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ─────────────────────────────────────────────────────────────────────

type Coord = { latitude: number; longitude: number };
type PhotoItem = {
  id: string;
  uri: string;
  storagePath: string | null;
  uploading: boolean;
  error: boolean;
};

// ─── Utilities ─────────────────────────────────────────────────────────────────

function to24h(time12: string): string {
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return time12;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

function haversineMeters(a: Coord, b: Coord): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ─── StepIndicator ────────────────────────────────────────────────────────────

const STEP_LABELS = ['Location', 'Details', 'Photos', 'Review'];

function StepIndicator({ step }: { step: number }) {
  return (
    <View style={si.row}>
      {STEP_LABELS.map((label, i) => (
        <React.Fragment key={label}>
          <View style={si.item}>
            <View style={[si.dot, i < step && si.dotDone, i === step && si.dotActive]}>
              {i < step ? (
                <Ionicons name="checkmark" size={13} color={COLORS.textInverse} />
              ) : (
                <Text style={[si.num, i === step && si.numActive]}>{i + 1}</Text>
              )}
            </View>
            <Text style={[si.label, i === step && si.labelActive]}>{label}</Text>
          </View>
          {i < STEP_LABELS.length - 1 && (
            <View style={[si.line, i < step && si.lineDone]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

const si = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  item: { alignItems: 'center', gap: 3 },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dotDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  num: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  numActive: { color: COLORS.textInverse },
  label: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', letterSpacing: 0.2 },
  labelActive: { color: COLORS.primary },
  line: { flex: 1, height: 1.5, backgroundColor: COLORS.border, marginBottom: 14, marginHorizontal: 3 },
  lineDone: { backgroundColor: COLORS.success },
});

// ─── SegmentedToggle ──────────────────────────────────────────────────────────

function SegmentedToggle({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={tog.row}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[tog.opt, opt.value === value && tog.optActive]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.7}
        >
          <Text style={[tog.label, opt.value === value && tog.labelActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tog = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  opt: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
  optActive: {
    backgroundColor: COLORS.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  labelActive: { color: COLORS.text, fontWeight: '700' },
});

// ─── FieldLabel ───────────────────────────────────────────────────────────────

function FieldLabel({ text, optional = false }: { text: string; optional?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
      <Text style={fld.label}>{text}</Text>
      {optional && <Text style={fld.optional}> · optional</Text>}
    </View>
  );
}

const fld = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  optional: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '400' },
});

// ─── ActionBar ────────────────────────────────────────────────────────────────

function ActionBar({
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled = false,
  loading = false,
  backLabel = 'Back',
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  backLabel?: string;
}) {
  return (
    <View style={ab.row}>
      {onBack ? (
        <TouchableOpacity style={ab.back} onPress={onBack} activeOpacity={0.7}>
          <Text style={ab.backText}>{backLabel}</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ flex: 0, width: 44 }} />
      )}
      <TouchableOpacity
        style={[ab.next, nextDisabled && ab.nextDisabled]}
        onPress={onNext}
        disabled={nextDisabled || loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={ab.nextText}>{nextLabel}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const ab = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 4 : 12,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  back: { paddingHorizontal: 14, paddingVertical: 12 },
  backText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 15 },
  next: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  nextDisabled: { backgroundColor: COLORS.border, shadowOpacity: 0, elevation: 0 },
  nextText: { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },
});

// ─── Step 0: Location ─────────────────────────────────────────────────────────

function LocationStep({
  userCoord,
  hasPermission,
  pinCoord,
  setPinCoord,
  nearbySpots,
  checkingNearby,
  onNext,
  onCancel,
}: {
  userCoord: Coord | null;
  hasPermission: boolean;
  pinCoord: Coord | null;
  setPinCoord: (c: Coord) => void;
  nearbySpots: ParkingSpot[];
  checkingNearby: boolean;
  onNext: () => void;
  onCancel: () => void;
}) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (userCoord && !pinCoord) {
      mapRef.current?.animateToRegion(
        { ...userCoord, latitudeDelta: 0.003, longitudeDelta: 0.003 },
        700,
      );
    }
  }, [userCoord]);

  if (!hasPermission) {
    return (
      <View style={ls.permBox}>
        <Ionicons name="location-outline" size={52} color={COLORS.textSecondary} />
        <Text style={ls.permTitle}>Location Access Needed</Text>
        <Text style={ls.permBody}>
          Enable location in your device Settings so we can place your spot accurately on the map.
        </Text>
      </View>
    );
  }

  const closestSpot =
    pinCoord && nearbySpots.length > 0 ? nearbySpots[0] : null;
  const closestDist =
    closestSpot && pinCoord
      ? Math.round(haversineMeters(pinCoord, { latitude: closestSpot.latitude, longitude: closestSpot.longitude }))
      : null;

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        mapType="none"
        initialRegion={{
          latitude: userCoord?.latitude ?? 14.5547,
          longitude: userCoord?.longitude ?? 121.0244,
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={(e) => setPinCoord(e.nativeEvent.coordinate)}
      >
        <UrlTile urlTemplate={OSM_TILE_URL} maximumZ={19} flipY={false} />
        {pinCoord && (
          <Marker
            coordinate={pinCoord}
            draggable
            onDragEnd={(e) => setPinCoord(e.nativeEvent.coordinate)}
          >
            <View style={ls.pinOuter}>
              <View style={ls.pinInner} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Floating info card */}
      <View style={ls.floatCard}>
        {!pinCoord ? (
          <>
            <Text style={ls.floatTitle}>Tap the map to place a pin</Text>
            <Text style={ls.floatSub}>Drag the pin to adjust precisely</Text>
          </>
        ) : checkingNearby ? (
          <View style={ls.inlineRow}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={ls.floatSub}>  Checking for nearby spots…</Text>
          </View>
        ) : closestSpot ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="warning-outline" size={16} color={COLORS.warning} />
              <Text style={ls.warnTitle}>Spot found {closestDist}m away</Text>
            </View>
            <Text style={ls.warnSub}>
              "{closestSpot.name}" is already here. Is this a different spot?
            </Text>
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.success} />
            <Text style={ls.okText}>No duplicates found — good to go</Text>
          </View>
        )}
      </View>

      <ActionBar
        backLabel="✕  Cancel"
        onBack={onCancel}
        onNext={onNext}
        nextDisabled={!pinCoord}
        nextLabel="Next  →"
      />
    </View>
  );
}

const ls = StyleSheet.create({
  permBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 14,
  },

  permTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  permBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  pinOuter: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary + '28',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.primary,
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  floatCard: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  inlineRow: { flexDirection: 'row', alignItems: 'center' },
  floatTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  floatSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 3 },
  warnTitle: { fontSize: 14, fontWeight: '700', color: COLORS.warning },
  warnSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 },
  okText: { fontSize: 14, fontWeight: '700', color: COLORS.success },
});

// ─── Rate Builder Sheet ───────────────────────────────────────────────────────

type VehicleTab = 'car' | 'motorcycle' | 'van';

type LocalVehicleRate = {
  mode: 'tiered' | 'flat';
  freeMinutes: string;
  firstHours: string;
  firstRate: string;
  succeedingRate: string;
  flatRate: string;
  flatWindowStart: string;
  flatWindowEnd: string;
  overnightEnabled: boolean;
  overnightCharge: string;
  overnightWindowStart: string;
  overnightWindowEnd: string;
  minimumCharge: string;
  dailyMaxCap: string;
  partialHourRounding: 'ceil' | 'floor';
};

const VEHICLE_DEFAULTS: Record<VehicleTab, LocalVehicleRate> = {
  car: {
    mode: 'tiered', freeMinutes: '', firstHours: '2', firstRate: '',
    succeedingRate: '', flatRate: '', flatWindowStart: '06:00', flatWindowEnd: '01:30',
    overnightEnabled: false, overnightCharge: '', overnightWindowStart: '01:30',
    overnightWindowEnd: '06:00', minimumCharge: '', dailyMaxCap: '', partialHourRounding: 'ceil',
  },
  motorcycle: {
    mode: 'flat', freeMinutes: '', firstHours: '2', firstRate: '',
    succeedingRate: '', flatRate: '', flatWindowStart: '06:00', flatWindowEnd: '01:30',
    overnightEnabled: false, overnightCharge: '', overnightWindowStart: '01:30',
    overnightWindowEnd: '06:00', minimumCharge: '', dailyMaxCap: '', partialHourRounding: 'ceil',
  },
  van: {
    mode: 'tiered', freeMinutes: '', firstHours: '2', firstRate: '',
    succeedingRate: '', flatRate: '', flatWindowStart: '06:00', flatWindowEnd: '01:30',
    overnightEnabled: false, overnightCharge: '', overnightWindowStart: '01:30',
    overnightWindowEnd: '06:00', minimumCharge: '', dailyMaxCap: '', partialHourRounding: 'ceil',
  },
};

function isRateConfigured(r: LocalVehicleRate): boolean {
  if (r.mode === 'tiered') return !!r.firstRate || !!r.succeedingRate;
  return !!r.flatRate;
}

function localRateToVehicleRate(r: LocalVehicleRate): VehicleRate {
  const out: VehicleRate = {};
  if (r.freeMinutes) out.freeMinutes = Number(r.freeMinutes);
  if (r.minimumCharge) out.minimumCharge = Number(r.minimumCharge);
  if (r.dailyMaxCap) out.dailyMaxCap = Number(r.dailyMaxCap);
  out.partialHourRounding = r.partialHourRounding;

  if (r.mode === 'flat') {
    if (r.flatRate) out.flatRate = Number(r.flatRate);
    if (r.flatWindowStart) out.flatRateWindowStart = r.flatWindowStart;
    if (r.flatWindowEnd) out.flatRateWindowEnd = r.flatWindowEnd;
  } else {
    if (r.firstHours) out.firstHours = Number(r.firstHours);
    if (r.firstRate) out.firstRate = Number(r.firstRate);
    if (r.succeedingRate) out.succeedingRate = Number(r.succeedingRate);
  }

  if (r.overnightEnabled && r.overnightCharge) {
    out.overnightCharge = Number(r.overnightCharge);
    if (r.overnightWindowStart) out.overnightWindowStart = r.overnightWindowStart;
    if (r.overnightWindowEnd) out.overnightWindowEnd = r.overnightWindowEnd;
  }

  return out;
}

function RateVehicleForm({
  rate,
  onChange,
  penaltiesSection,
}: {
  rate: LocalVehicleRate;
  onChange: (r: LocalVehicleRate) => void;
  penaltiesSection?: React.ReactNode;
}) {
  function set(patch: Partial<LocalVehicleRate>) {
    onChange({ ...rate, ...patch });
  }

  const inputStyle = [rb.input];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 80 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Mode toggle */}
      <View>
        <Text style={rb.fieldLabel}>Rate Type</Text>
        <SegmentedToggle
          options={[
            { label: 'First hour tier', value: 'tiered' },
            { label: 'Flat rate', value: 'flat' },
          ]}
          value={rate.mode}
          onChange={(v) => set({ mode: v as 'tiered' | 'flat' })}
        />
      </View>

      {/* Free minutes */}
      <View>
        <Text style={rb.fieldLabel}>Free First (optional)</Text>
        <View style={rb.rowInput}>
          <TextInput
            style={[inputStyle, { flex: 1 }]}
            value={rate.freeMinutes}
            onChangeText={(t) => set({ freeMinutes: t.replace(/\D/g, '') })}
            placeholder="0"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="number-pad"
          />
          <Text style={rb.unit}>min free</Text>
        </View>
      </View>

      {rate.mode === 'tiered' ? (
        <>
          {/* First tier */}
          <View>
            <Text style={rb.fieldLabel}>First Tier Rate</Text>
            <View style={rb.rowInput}>
              <Text style={rb.peso}>₱</Text>
              <TextInput
                style={[inputStyle, { flex: 1 }]}
                value={rate.firstRate}
                onChangeText={(t) => set({ firstRate: t.replace(/[^0-9.]/g, '') })}
                placeholder="60"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="decimal-pad"
              />
              <Text style={rb.unit}>for first</Text>
              <TextInput
                style={[inputStyle, { width: 48 }]}
                value={rate.firstHours}
                onChangeText={(t) => set({ firstHours: t.replace(/\D/g, '') })}
                placeholder="2"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="number-pad"
              />
              <Text style={rb.unit}>hr</Text>
            </View>
          </View>

          {/* Succeeding rate */}
          <View>
            <Text style={rb.fieldLabel}>Then Per Hour</Text>
            <View style={rb.rowInput}>
              <Text style={rb.peso}>₱</Text>
              <TextInput
                style={[inputStyle, { flex: 1 }]}
                value={rate.succeedingRate}
                onChangeText={(t) => set({ succeedingRate: t.replace(/[^0-9.]/g, '') })}
                placeholder="30"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="decimal-pad"
              />
              <Text style={rb.unit}>/ hr after</Text>
            </View>
          </View>
        </>
      ) : (
        <>
          {/* Flat rate */}
          <View>
            <Text style={rb.fieldLabel}>Flat Rate</Text>
            <View style={rb.rowInput}>
              <Text style={rb.peso}>₱</Text>
              <TextInput
                style={[inputStyle, { flex: 1 }]}
                value={rate.flatRate}
                onChangeText={(t) => set({ flatRate: t.replace(/[^0-9.]/g, '') })}
                placeholder="50"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="decimal-pad"
              />
              <Text style={rb.unit}>flat</Text>
            </View>
          </View>

          {/* Flat window */}
          <View>
            <Text style={rb.fieldLabel}>Applies From / To (24h)</Text>
            <View style={rb.rowInput}>
              <TextInput
                style={[inputStyle, { width: 72 }]}
                value={rate.flatWindowStart}
                onChangeText={(t) => set({ flatWindowStart: t })}
                placeholder="06:00"
                placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={rb.unit}>to</Text>
              <TextInput
                style={[inputStyle, { width: 72 }]}
                value={rate.flatWindowEnd}
                onChangeText={(t) => set({ flatWindowEnd: t })}
                placeholder="01:30"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
          </View>
        </>
      )}

      {/* Overnight */}
      <View style={rb.sectionDivider} />
      <View>
        <View style={rb.toggleRow}>
          <Text style={rb.fieldLabel}>Overnight Surcharge</Text>
          <TouchableOpacity
            style={[rb.togglePill, rate.overnightEnabled && rb.togglePillOn]}
            onPress={() => set({ overnightEnabled: !rate.overnightEnabled })}
            activeOpacity={0.75}
          >
            <Text style={[rb.toggleText, rate.overnightEnabled && rb.toggleTextOn]}>
              {rate.overnightEnabled ? 'On' : 'Off'}
            </Text>
          </TouchableOpacity>
        </View>

        {rate.overnightEnabled && (
          <View style={{ gap: 10, marginTop: 10 }}>
            <View style={rb.rowInput}>
              <Text style={rb.peso}>₱</Text>
              <TextInput
                style={[inputStyle, { flex: 1 }]}
                value={rate.overnightCharge}
                onChangeText={(t) => set({ overnightCharge: t.replace(/[^0-9.]/g, '') })}
                placeholder="300"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="decimal-pad"
              />
              <Text style={rb.unit}>overnight</Text>
            </View>
            <View style={rb.rowInput}>
              <Text style={rb.unit}>from</Text>
              <TextInput
                style={[inputStyle, { width: 72 }]}
                value={rate.overnightWindowStart}
                onChangeText={(t) => set({ overnightWindowStart: t })}
                placeholder="01:30"
                placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={rb.unit}>to</Text>
              <TextInput
                style={[inputStyle, { width: 72 }]}
                value={rate.overnightWindowEnd}
                onChangeText={(t) => set({ overnightWindowEnd: t })}
                placeholder="06:00"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
          </View>
        )}
      </View>

      {/* Minimum charge */}
      <View>
        <Text style={rb.fieldLabel}>Minimum Charge (optional)</Text>
        <View style={rb.rowInput}>
          <Text style={rb.peso}>₱</Text>
          <TextInput
            style={[inputStyle, { flex: 1 }]}
            value={rate.minimumCharge}
            onChangeText={(t) => set({ minimumCharge: t.replace(/[^0-9.]/g, '') })}
            placeholder="0"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="decimal-pad"
          />
          <Text style={rb.unit}>minimum</Text>
        </View>
      </View>

      {/* Daily max cap */}
      <View>
        <Text style={rb.fieldLabel}>Daily Maximum Cap (optional)</Text>
        <View style={rb.rowInput}>
          <Text style={rb.peso}>₱</Text>
          <TextInput
            style={[inputStyle, { flex: 1 }]}
            value={rate.dailyMaxCap}
            onChangeText={(t) => set({ dailyMaxCap: t.replace(/[^0-9.]/g, '') })}
            placeholder="e.g. 300"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="decimal-pad"
          />
          <Text style={rb.unit}>max/day</Text>
        </View>
      </View>

      {/* Partial hour billing */}
      {rate.mode === 'tiered' && (
        <View>
          <Text style={rb.fieldLabel}>Partial Hour Billing</Text>
          <SegmentedToggle
            options={[
              { label: 'Full hour (ceil)', value: 'ceil' },
              { label: 'Exact minutes', value: 'floor' },
            ]}
            value={rate.partialHourRounding}
            onChange={(v) => set({ partialHourRounding: v as 'ceil' | 'floor' })}
          />
        </View>
      )}

      {penaltiesSection}
    </ScrollView>
  );
}

function RateBuilderSheet({
  visible,
  onClose,
  onApply,
  spotType,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: (rates: { car?: VehicleRate; motorcycle?: VehicleRate; van?: VehicleRate; lostTicketFee?: number; penaltyNotes?: string; notes?: string }) => void;
  spotType: ParkingType;
}) {
  const [activeTab, setActiveTab] = useState<VehicleTab>('car');
  const [carRate, setCarRate] = useState<LocalVehicleRate>({ ...VEHICLE_DEFAULTS.car });
  const [motoRate, setMotoRate] = useState<LocalVehicleRate>({ ...VEHICLE_DEFAULTS.motorcycle });
  const [vanRate, setVanRate] = useState<LocalVehicleRate>({ ...VEHICLE_DEFAULTS.van });
  const [lostTicket, setLostTicket] = useState('');
  const [notes, setNotes] = useState('');
  const [penaltiesOpen, setPenaltiesOpen] = useState(false);

  // Apply smart defaults when spot type changes
  useEffect(() => {
    if (spotType === 'mall') {
      setCarRate((r) => ({ ...r, mode: 'tiered', firstHours: '2', overnightEnabled: true, overnightWindowStart: '01:30', overnightWindowEnd: '06:00' }));
      setMotoRate((r) => ({ ...r, mode: 'flat' }));
    } else if (spotType === 'private_lot') {
      setCarRate((r) => ({ ...r, mode: 'flat' }));
      setMotoRate((r) => ({ ...r, mode: 'flat' }));
    }
  }, [spotType]);

  function handleApply() {
    const result: Parameters<typeof onApply>[0] = {};
    if (isRateConfigured(carRate)) result.car = localRateToVehicleRate(carRate);
    if (isRateConfigured(motoRate)) result.motorcycle = localRateToVehicleRate(motoRate);
    if (isRateConfigured(vanRate)) result.van = localRateToVehicleRate(vanRate);
    if (lostTicket) result.lostTicketFee = Number(lostTicket);
    if (notes) result.notes = notes;
    onApply(result);
  }

  const tabs: { key: VehicleTab; label: string; rate: LocalVehicleRate }[] = [
    { key: 'car', label: 'Car', rate: carRate },
    { key: 'motorcycle', label: 'Moto', rate: motoRate },
    { key: 'van', label: 'Van', rate: vanRate },
  ];

  const activeRate = activeTab === 'car' ? carRate : activeTab === 'motorcycle' ? motoRate : vanRate;
  const setActiveRate = activeTab === 'car' ? setCarRate : activeTab === 'motorcycle' ? setMotoRate : setVanRate;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={rb.sheet} edges={['top']}>
        {/* Header */}
        <View style={rb.sheetHeader}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={rb.sheetCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={rb.sheetTitle}>Detailed Rates</Text>
          <TouchableOpacity onPress={handleApply} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={rb.sheetDone}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Vehicle tabs */}
        <View style={rb.tabRow}>
          {tabs.map(({ key, label, rate }) => (
            <TouchableOpacity
              key={key}
              style={[rb.tab, activeTab === key && rb.tabActive]}
              onPress={() => setActiveTab(key)}
              activeOpacity={0.7}
            >
              <Text style={[rb.tabLabel, activeTab === key && rb.tabLabelActive]}>
                {isRateConfigured(rate) ? '● ' : '○ '}{label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Vehicle form + penalties — unified scroll with keyboard-avoid */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <RateVehicleForm
            rate={activeRate}
            onChange={setActiveRate}
            penaltiesSection={
              <View style={{ marginTop: 8 }}>
                <View style={rb.sectionDivider} />
                <TouchableOpacity
                  style={rb.penaltiesHeader}
                  onPress={() => setPenaltiesOpen((o) => !o)}
                  activeOpacity={0.75}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name={penaltiesOpen ? 'chevron-down' : 'add'} size={14} color={COLORS.textSecondary} />
                    <Text style={rb.penaltiesTitle}>Penalties & Notes</Text>
                  </View>
                </TouchableOpacity>
                {penaltiesOpen && (
                  <View style={rb.penaltiesBody}>
                    <View style={rb.rowInput}>
                      <Text style={rb.unit}>Lost ticket ₱</Text>
                      <TextInput
                        style={[rb.input, { flex: 1 }]}
                        value={lostTicket}
                        onChangeText={(t) => setLostTicket(t.replace(/\D/g, ''))}
                        placeholder="500"
                        placeholderTextColor={COLORS.textSecondary}
                        keyboardType="number-pad"
                      />
                    </View>
                    <TextInput
                      style={[rb.input, { minHeight: 60 }]}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder='e.g. "Free 2hr with ₱500 spend at SM Cinemas"'
                      placeholderTextColor={COLORS.textSecondary}
                      multiline
                    />
                  </View>
                )}
              </View>
            }
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const rb = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: COLORS.background },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  sheetCancel: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '600' },
  sheetDone: { fontSize: 15, color: COLORS.primary, fontWeight: '700' },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
    gap: 4,
    paddingTop: 10,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    marginBottom: -1,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.primary },
  tabLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  tabLabelActive: { color: COLORS.primary, fontWeight: '700' },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 7,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
  },
  rowInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  peso: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  unit: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  sectionDivider: { height: 1, backgroundColor: COLORS.border },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  togglePill: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  togglePillOn: { backgroundColor: COLORS.primary + '18', borderColor: COLORS.primary },
  toggleText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  toggleTextOn: { color: COLORS.primary },
  penaltiesWrap: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  penaltiesHeader: { paddingHorizontal: 18, paddingVertical: 13 },
  penaltiesTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  penaltiesBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
});

// ─── Step 1: Details ──────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: ParkingType; label: string; desc: string }[] = [
  { value: 'street', label: 'Street', desc: 'Public road' },
  { value: 'mall', label: 'Mall', desc: 'Commercial lot' },
  { value: 'private_lot', label: 'Private', desc: 'Gated / building' },
];

function DetailsStep({
  name, setName,
  type, setType,
  isPaid, setIsPaid,
  hourlyRate, setHourlyRate,
  detailedRates, setDetailedRates,
  is24Hours, setIs24Hours,
  openTime, setOpenTime,
  closeTime, setCloseTime,
  landmark, setLandmark,
  onBack, onNext,
}: {
  name: string; setName: (v: string) => void;
  type: ParkingType; setType: (v: ParkingType) => void;
  isPaid: boolean; setIsPaid: (v: boolean) => void;
  hourlyRate: string; setHourlyRate: (v: string) => void;
  detailedRates: DetailedRates | null; setDetailedRates: (v: DetailedRates | null) => void;
  is24Hours: boolean; setIs24Hours: (v: boolean) => void;
  openTime: string; setOpenTime: (v: string) => void;
  closeTime: string; setCloseTime: (v: string) => void;
  landmark: string; setLandmark: (v: string) => void;
  onBack: () => void; onNext: () => void;
}) {
  const [rateBuilderVisible, setRateBuilderVisible] = useState(false);
  const canNext = name.trim().length >= 2;
  const showNameHint = name.trim().length > 0 && name.trim().length < 2;
  const hasDetailedRates = detailedRates && (detailedRates.car || detailedRates.motorcycle || detailedRates.van);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={ds.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <View style={ds.field}>
          <FieldLabel text="Spot Name" />
          <TextInput
            style={ds.input}
            value={name}
            onChangeText={(t) => setName(t.slice(0, 60))}
            placeholder="e.g. SM Aura Premier — Level B2"
            placeholderTextColor={COLORS.textSecondary}
            returnKeyType="next"
            autoCorrect={false}
          />
          <View style={ds.inputFooter}>
            {showNameHint ? (
              <Text style={ds.inputHint}>At least 2 characters required</Text>
            ) : (
              <View />
            )}
            <Text style={ds.counter}>{name.length}/60</Text>
          </View>
        </View>

        {/* Type */}
        <View style={ds.field}>
          <FieldLabel text="Parking Type" />
          <View style={ds.typeRow}>
            {TYPE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[ds.typeChip, type === opt.value && ds.typeChipActive]}
                onPress={() => setType(opt.value)}
                activeOpacity={0.75}
              >
                <Text style={[ds.typeLabel, type === opt.value && ds.typeLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={[ds.typeDesc, type === opt.value && ds.typeDescActive]}>
                  {opt.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Cost */}
        <View style={ds.field}>
          <FieldLabel text="Parking Cost" />
          <SegmentedToggle
            options={[
              { label: 'Free', value: 'free' },
              { label: 'Paid', value: 'paid' },
            ]}
            value={isPaid ? 'paid' : 'free'}
            onChange={(v) => setIsPaid(v === 'paid')}
          />
          {isPaid && (
            <>
              <View style={ds.rateRow}>
                <Text style={ds.ratePrefix}>₱</Text>
                <TextInput
                  style={[ds.input, ds.rateInput]}
                  value={hourlyRate}
                  onChangeText={(t) => setHourlyRate(t.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="decimal-pad"
                />
                <Text style={ds.rateSuffix}>per hour</Text>
              </View>

              {/* Detailed rates CTA */}
              <TouchableOpacity
                style={[ds.detailedRatesCta, hasDetailedRates && ds.detailedRatesCtaActive]}
                onPress={() => setRateBuilderVisible(true)}
                activeOpacity={0.75}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons
                    name={hasDetailedRates ? 'checkmark-circle' : 'add-circle-outline'}
                    size={15}
                    color={hasDetailedRates ? COLORS.success : COLORS.primary}
                  />
                  <Text style={[ds.detailedRatesCtaText, hasDetailedRates && ds.detailedRatesCtaTextActive]}>
                    {hasDetailedRates ? 'Detailed rates configured' : 'Add detailed rates'}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={hasDetailedRates ? COLORS.success : COLORS.primary} />
                </View>
              </TouchableOpacity>

              <RateBuilderSheet
                visible={rateBuilderVisible}
                onClose={() => setRateBuilderVisible(false)}
                onApply={(rates) => {
                  setDetailedRates(Object.keys(rates).length > 0 ? rates : null);
                  setRateBuilderVisible(false);
                }}
                spotType={type}
              />
            </>
          )}
        </View>

        {/* Operating Hours */}
        <View style={ds.field}>
          <FieldLabel text="Operating Hours" />
          <SegmentedToggle
            options={[
              { label: '24 Hours', value: 'always' },
              { label: 'Set Hours', value: 'custom' },
            ]}
            value={is24Hours ? 'always' : 'custom'}
            onChange={(v) => setIs24Hours(v === 'always')}
          />
          {!is24Hours && (
            <View style={ds.hoursRow}>
              <View style={{ flex: 1 }}>
                <Text style={ds.hoursLabel}>Opens at</Text>
                <TextInput
                  style={ds.input}
                  value={openTime}
                  onChangeText={setOpenTime}
                  placeholder="7:00 AM"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
              <Text style={ds.hoursDash}>–</Text>
              <View style={{ flex: 1 }}>
                <Text style={ds.hoursLabel}>Closes at</Text>
                <TextInput
                  style={ds.input}
                  value={closeTime}
                  onChangeText={setCloseTime}
                  placeholder="10:00 PM"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>
          )}
        </View>

        {/* Landmark */}
        <View style={ds.field}>
          <FieldLabel text="Near what building?" optional />
          <TextInput
            style={ds.input}
            value={landmark}
            onChangeText={setLandmark}
            placeholder="e.g. Uptown Mall, BGC"
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <ActionBar
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!canNext}
        nextLabel="Next  →"
      />
    </KeyboardAvoidingView>
  );
}

const ds = StyleSheet.create({
  scroll: { padding: 20 },
  field: { marginBottom: 22 },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  inputHint: { fontSize: 12, color: '#D97706', fontWeight: '600' },
  counter: { fontSize: 11, color: COLORS.textSecondary },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: COLORS.background,
    gap: 3,
  },
  typeChipActive: { borderColor: COLORS.primary, backgroundColor: '#EFF6FF' },
  typeLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  typeLabelActive: { color: COLORS.primary },
  typeDesc: { fontSize: 11, color: COLORS.textSecondary },
  typeDescActive: { color: COLORS.primary + 'AA' },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  rateInput: { flex: 1, marginBottom: 0 },
  ratePrefix: { fontSize: 20, fontWeight: '700', color: COLORS.text, width: 20 },
  rateSuffix: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  detailedRatesCta: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  detailedRatesCtaActive: {
    borderStyle: 'solid',
    borderColor: COLORS.primary,
    backgroundColor: '#EFF6FF',
  },
  detailedRatesCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  detailedRatesCtaTextActive: { color: COLORS.primary },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  hoursDash: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  hoursLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 5,
  },
});

// ─── Step 2: Photos ───────────────────────────────────────────────────────────

const THUMB_SIZE = (SCREEN_WIDTH - 40 - 16) / 3;

function PhotosStep({
  photos,
  onAddPhotos,
  onRemovePhoto,
  onRetryPhoto,
  onBack,
  onNext,
}: {
  photos: PhotoItem[];
  onAddPhotos: () => void;
  onRemovePhoto: (id: string) => void;
  onRetryPhoto: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [tipOpen, setTipOpen] = useState(false);
  const uploading = photos.some((p) => p.uploading);
  const uploadedCount = photos.filter((p) => p.storagePath && !p.error).length;
  const hasError = photos.some((p) => p.error);
  const canNext = uploadedCount >= 1 && !uploading;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={ps.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={ps.headline}>Show us the spot</Text>
        <Text style={ps.subline}>
          Clear photos of the entrance or rate board help the community verify quickly.
        </Text>

        {/* Tip collapsible */}
        <TouchableOpacity
          style={ps.tip}
          onPress={() => setTipOpen((o) => !o)}
          activeOpacity={0.75}
        >
          <View style={ps.tipHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="camera-outline" size={15} color={COLORS.textSecondary} />
              <Text style={ps.tipTitle}>What makes a good photo?</Text>
            </View>
            <Ionicons name={tipOpen ? 'chevron-up' : 'chevron-down'} size={15} color={COLORS.textSecondary} />
          </View>
          {tipOpen && (
            <View style={ps.tipBody}>
              {[
                'The entrance gate or driveway',
                'The rate board or signage',
                'Interior showing available slots',
                'Well-lit, in focus, landscape preferred',
              ].map((t) => (
                <Text key={t} style={ps.tipItem}>· {t}</Text>
              ))}
            </View>
          )}
        </TouchableOpacity>

        {/* Photo grid */}
        {photos.length > 0 && (
          <View style={ps.grid}>
            {photos.map((photo) => (
              <View key={photo.id} style={ps.thumb}>
                <Image source={{ uri: photo.uri }} style={ps.thumbImg} />

                {photo.uploading && (
                  <View style={ps.overlay}>
                    <ActivityIndicator color="#fff" size="small" />
                  </View>
                )}

                {photo.error && (
                  <TouchableOpacity
                    style={[ps.overlay, ps.overlayError]}
                    onPress={() => onRetryPhoto(photo.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={ps.errorMark}>↺</Text>
                    <Text style={ps.retryLabel}>Retry</Text>
                  </TouchableOpacity>
                )}

                {!photo.uploading && (
                  <TouchableOpacity
                    style={ps.removeBtn}
                    onPress={() => onRemovePhoto(photo.id)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={ps.removeTxt}>✕</Text>
                  </TouchableOpacity>
                )}

                {photo.storagePath && !photo.error && (
                  <View style={ps.checkBadge}>
                    <Ionicons name="checkmark" size={11} color={COLORS.textInverse} />
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Add button */}
        <TouchableOpacity
          style={[ps.addZone, uploading && ps.addZoneDisabled]}
          onPress={onAddPhotos}
          disabled={uploading}
          activeOpacity={0.7}
        >
          {uploading ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <>
              <Text style={ps.addIcon}>+</Text>
              <Text style={ps.addLabel}>
                {photos.length === 0 ? 'Add Photos' : 'Add More'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {hasError && (
          <View style={ps.errorBanner}>
            <Text style={ps.errorBannerText}>
              Some photos failed to upload. Tap a red photo to retry, or remove it.
            </Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Status strip */}
      <View style={ps.statusStrip}>
        <View style={[ps.statusDot, uploadedCount >= 1 && ps.statusDotReady]} />
        <Text style={ps.statusText}>
          {uploading
            ? 'Uploading…'
            : uploadedCount === 0
            ? 'At least 1 photo required'
            : `${uploadedCount} photo${uploadedCount !== 1 ? 's' : ''} ready`}
        </Text>
      </View>

      <ActionBar
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!canNext}
        nextLabel="Review  →"
      />
    </KeyboardAvoidingView>
  );
}

const ps = StyleSheet.create({
  scroll: { padding: 20, gap: 16 },
  headline: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  subline: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  tip: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tipTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  tipBody: { marginTop: 10, gap: 5 },
  tipItem: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  thumbImg: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.46)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayError: { backgroundColor: 'rgba(220,38,38,0.72)' },
  errorMark: { color: '#fff', fontSize: 22, fontWeight: '800' },
  retryLabel: { color: '#fff', fontSize: 9, fontWeight: '700', marginTop: 1 },
  removeBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },
  checkBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addZone: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 4,
  },
  addZoneDisabled: { borderColor: COLORS.border, opacity: 0.55 },
  addIcon: { fontSize: 28, color: COLORS.primary, lineHeight: 32 },
  addLabel: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
  },
  errorBannerText: { color: '#DC2626', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  statusDotReady: { backgroundColor: '#16A34A' },
  statusText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
});

// ─── Step 3: Confirm ──────────────────────────────────────────────────────────

function ConfirmStep({
  pinCoord,
  name, type, isPaid, hourlyRate, detailedRates,
  is24Hours, openTime, closeTime, landmark,
  photos, submitting,
  onBack, onSubmit,
}: {
  pinCoord: Coord;
  name: string; type: ParkingType;
  isPaid: boolean; hourlyRate: string; detailedRates: DetailedRates | null;
  is24Hours: boolean; openTime: string; closeTime: string;
  landmark: string; photos: PhotoItem[];
  submitting: boolean; onBack: () => void; onSubmit: () => void;
}) {
  const readyPhotos = photos.filter((p) => p.storagePath && !p.error);
  const hasDetailedBreakdown = detailedRates && (detailedRates.car || detailedRates.motorcycle || detailedRates.van);
  const costLabel = !isPaid
    ? 'Free'
    : hasDetailedBreakdown
    ? 'Paid (detailed rates set)'
    : hourlyRate
    ? `₱${hourlyRate} / hour`
    : 'Paid (rate TBC)';
  const hoursLabel = is24Hours ? '24 hours' : `${openTime} – ${closeTime}`;

  const rows: { label: string; value: string }[] = [
    { label: 'Name', value: name },
    { label: 'Type', value: type.replace('_', ' ') },
    { label: 'Cost', value: costLabel },
    { label: 'Hours', value: hoursLabel },
    ...(landmark ? [{ label: 'Near', value: landmark }] : []),
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={cs.scroll} showsVerticalScrollIndicator={false}>
        <Text style={cs.headline}>Looks good?</Text>
        <Text style={cs.subline}>Review your spot before submitting to the community.</Text>

        {/* Mini map */}
        <View style={cs.mapWrap}>
          <MapView
            style={cs.map}
            mapType="none"
            region={{
              ...pinCoord,
              latitudeDelta: 0.003,
              longitudeDelta: 0.003,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            pointerEvents="none"
          >
            <UrlTile urlTemplate={OSM_TILE_URL} maximumZ={19} flipY={false} />
            <Marker coordinate={pinCoord}>
              <View style={ls.pinOuter}>
                <View style={ls.pinInner} />
              </View>
            </Marker>
          </MapView>
        </View>

        {/* Detail rows */}
        <View style={cs.card}>
          <Text style={cs.cardTitle}>Spot Details</Text>
          {rows.map((row, i) => (
            <React.Fragment key={row.label}>
              {i > 0 && <View style={cs.divider} />}
              <View style={cs.row}>
                <Text style={cs.rowLabel}>{row.label}</Text>
                <Text style={cs.rowValue} numberOfLines={2}>{row.value}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Photos strip */}
        <View style={cs.card}>
          <Text style={cs.cardTitle}>{readyPhotos.length} Photo{readyPhotos.length !== 1 ? 's' : ''}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 10 }}
          >
            {readyPhotos.map((p) => (
              <Image key={p.id} source={{ uri: p.uri }} style={cs.photoThumb} />
            ))}
          </ScrollView>
        </View>

        {/* Community note */}
        <View style={cs.infoBox}>
          <Ionicons name="people-outline" size={22} color={COLORS.primary} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={cs.infoTitle}>Community review process</Text>
            <Text style={cs.infoBody}>
              After community members verify it, you'll earn{' '}
              <Text style={{ fontWeight: '800' }}>+10 points</Text> toward Hawk tier.
            </Text>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <ActionBar
        onBack={onBack}
        onNext={onSubmit}
        nextLabel="Submit for Review"
        loading={submitting}
      />
    </KeyboardAvoidingView>
  );
}

const cs = StyleSheet.create({
  scroll: { padding: 20, gap: 16 },
  headline: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  subline: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  mapWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 176,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  map: { flex: 1 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 9,
    gap: 12,
  },
  rowLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600', flex: 0 },
  rowValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
    textTransform: 'capitalize',
  },
  divider: { height: 1, backgroundColor: COLORS.border },
  photoThumb: {
    width: 76,
    height: 76,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: COLORS.border,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
  },
  infoTitle: { fontSize: 14, fontWeight: '800', color: '#1E40AF' },
  infoBody: { fontSize: 13, color: '#1E40AF', lineHeight: 18 },
});

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({ onDone }: { onDone: () => void }) {
  return (
    <View style={suc.wrap}>
      <View style={suc.iconWrap}>
        <Ionicons name="checkmark" size={42} color={COLORS.success} />
      </View>
      <Text style={suc.title}>Spot submitted!</Text>
      <Text style={suc.body}>
        Your spot is in the community review queue. Once it's verified, you'll earn points
        toward Hawk tier.
      </Text>
      <View style={suc.pointBadge}>
        <Ionicons name="star-outline" size={14} color={COLORS.primary} />
        <Text style={suc.pointText}>+10 points when verified</Text>
      </View>
      <TouchableOpacity style={suc.btn} onPress={onDone} activeOpacity={0.85}>
        <Text style={suc.btnText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const suc = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
    backgroundColor: COLORS.background,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  body: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  pointBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  pointText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 48,
    paddingVertical: 14,
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.2 },
});

// ─── Moderation Section ───────────────────────────────────────────────────────

type VotingState = Record<string, boolean>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function formatRate(rate: VehicleRate): string {
  const parts: string[] = [];
  if (rate.freeMinutes) parts.push(`${rate.freeMinutes}min free`);
  if (rate.firstRate != null && rate.firstHours) {
    parts.push(`₱${rate.firstRate} / ${rate.firstHours}hr`);
    if (rate.succeedingRate != null) parts.push(`then ₱${rate.succeedingRate}/hr`);
  } else if (rate.flatRate != null) {
    parts.push(`₱${rate.flatRate} flat`);
    if (rate.flatRateWindowStart && rate.flatRateWindowEnd) {
      parts.push(`${rate.flatRateWindowStart}–${rate.flatRateWindowEnd}`);
    }
  }
  if (rate.dailyMaxCap != null) parts.push(`max ₱${rate.dailyMaxCap}/day`);
  return parts.join('  ·  ') || '—';
}

const VEHICLE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  car: 'car-outline',
  motorcycle: 'bicycle-outline',
  van: 'bus-outline',
};

function DetailedRatesView({ rates }: { rates: DetailedRates }) {
  const vehicles: { key: 'car' | 'motorcycle' | 'van'; label: string }[] = [
    { key: 'car', label: 'Car' },
    { key: 'motorcycle', label: 'Motorcycle' },
    { key: 'van', label: 'Van' },
  ];
  const configured = vehicles.filter((v) => rates[v.key]);

  if (!configured.length) return null;

  return (
    <View style={sdm.ratesBlock}>
      <Text style={sdm.blockLabel}>Detailed Rates</Text>
      {configured.map(({ key, label }) => (
        <View key={key} style={sdm.rateRow}>
          <View style={sdm.rateIcon}>
            <Ionicons name={VEHICLE_ICONS[key]} size={14} color={COLORS.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={sdm.rateLabel}>{label}</Text>
            <Text style={sdm.rateValue}>{formatRate(rates[key]!)}</Text>
          </View>
        </View>
      ))}
      {(rates.lostTicketFee != null || rates.penaltyNotes || rates.notes) && (
        <View style={sdm.penaltiesBlock}>
          {rates.lostTicketFee != null && (
            <Text style={sdm.penaltyText}>Lost ticket: ₱{rates.lostTicketFee}</Text>
          )}
          {rates.penaltyNotes ? <Text style={sdm.penaltyText}>{rates.penaltyNotes}</Text> : null}
          {rates.notes ? <Text style={sdm.noteText}>{rates.notes}</Text> : null}
        </View>
      )}
    </View>
  );
}

// ── Spot Detail Modal ─────────────────────────────────────────────────────────

function SpotDetailModal({
  item,
  visible,
  onClose,
  onVote,
  votingApprove,
  votingReject,
}: {
  item: ModerationQueueItem | null;
  visible: boolean;
  onClose: () => void;
  onVote: (id: string, approve: boolean) => void;
  votingApprove: boolean;
  votingReject: boolean;
}) {
  const spot = item?.payload?.spot as {
    name?: string;
    type?: string;
    rates?: string;
    operatingHours?: string;
    latitude?: number;
    longitude?: number;
    detailedRates?: DetailedRates;
  } | undefined;

  const { data: photos, isLoading: photosLoading } = useQuery({
    queryKey: ['spot-photos', item?.targetParkingSpotId],
    queryFn: () => parkingApi.getPhotos(item!.targetParkingSpotId!),
    enabled: visible && !!item?.targetParkingSpotId,
    staleTime: 60_000,
  });

  const TYPE_LABEL: Record<string, string> = {
    street: 'Street Parking',
    mall: 'Mall Parking',
    private_lot: 'Private Lot',
  };

  if (!item) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={sdm.sheet} edges={['top']}>
        {/* Header */}
        <View style={sdm.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={sdm.headerTitle}>Review Submission</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={sdm.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Photo gallery */}
          {photosLoading ? (
            <View style={sdm.photoPlaceholder}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : photos && photos.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={sdm.photoStrip}
              style={sdm.photoScroll}
            >
              {photos.map((p) => (
                <Image
                  key={p.id}
                  source={{ uri: p.publicUrl }}
                  style={sdm.photo}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : (
            <View style={sdm.photoPlaceholder}>
              <Ionicons name="camera-outline" size={28} color={COLORS.textTertiary} />
              <Text style={sdm.photoPlaceholderText}>No photos attached</Text>
            </View>
          )}

          {/* Meta pills */}
          <View style={sdm.metaRow}>
            <View style={sdm.kindPill}>
              <Text style={sdm.kindText}>{item.kind.replace(/_/g, ' ')}</Text>
            </View>
            <View style={[sdm.tierPill, { backgroundColor: COLORS.surface }]}>
              <Ionicons name="person-outline" size={11} color={COLORS.textSecondary} />
              <Text style={sdm.tierText}>{item.submitterTier ?? 'pigeon'} contributor</Text>
            </View>
            <Text style={sdm.timeAgo}>{timeAgo(item.createdAt)}</Text>
          </View>

          {/* Spot name */}
          <Text style={sdm.spotName}>{spot?.name ?? 'Unnamed spot'}</Text>

          {/* Score chips */}
          <View style={sdm.scoreRow}>
            <View style={[sdm.scorePill, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="checkmark" size={13} color="#16A34A" />
              <Text style={[sdm.scoreNum, { color: '#16A34A' }]}>{item.approvalScore} approval</Text>
            </View>
            <View style={[sdm.scorePill, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="close" size={13} color="#DC2626" />
              <Text style={[sdm.scoreNum, { color: '#DC2626' }]}>{item.rejectionScore} rejection</Text>
            </View>
          </View>

          {/* Info rows */}
          <View style={sdm.infoBlock}>
            {spot?.type && (
              <View style={sdm.infoRow}>
                <View style={sdm.infoIconWrap}>
                  <Ionicons name="car-outline" size={15} color={COLORS.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sdm.infoLabel}>Type</Text>
                  <Text style={sdm.infoValue}>{TYPE_LABEL[spot.type] ?? spot.type}</Text>
                </View>
              </View>
            )}
            {spot?.operatingHours && (
              <View style={sdm.infoRow}>
                <View style={sdm.infoIconWrap}>
                  <Ionicons name="time-outline" size={15} color={COLORS.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sdm.infoLabel}>Hours</Text>
                  <Text style={sdm.infoValue}>{spot.operatingHours}</Text>
                </View>
              </View>
            )}
            {spot?.rates && (
              <View style={sdm.infoRow}>
                <View style={sdm.infoIconWrap}>
                  <Ionicons name="pricetag-outline" size={15} color={COLORS.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sdm.infoLabel}>Rates</Text>
                  <Text style={sdm.infoValue}>{spot.rates}</Text>
                </View>
              </View>
            )}
            {spot?.latitude != null && spot?.longitude != null && (
              <View style={sdm.infoRow}>
                <View style={sdm.infoIconWrap}>
                  <Ionicons name="location-outline" size={15} color={COLORS.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sdm.infoLabel}>Coordinates</Text>
                  <Text style={sdm.infoValue}>
                    {Number(spot.latitude).toFixed(6)}, {Number(spot.longitude).toFixed(6)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Detailed rates breakdown */}
          {spot?.detailedRates && Object.keys(spot.detailedRates).some(
            (k) => ['car', 'motorcycle', 'van'].includes(k)
          ) && (
            <DetailedRatesView rates={spot.detailedRates} />
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Sticky vote bar */}
        <SafeAreaView edges={['bottom']} style={sdm.voteBar}>
          <TouchableOpacity
            style={[sdm.voteBtn, sdm.rejectBtn, votingReject && sdm.voteBtnLoading]}
            onPress={() => onVote(item.id, false)}
            disabled={votingApprove || votingReject}
            activeOpacity={0.8}
          >
            {votingReject ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <>
                <Ionicons name="close-circle" size={18} color="#DC2626" />
                <Text style={sdm.rejectText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[sdm.voteBtn, sdm.approveBtn, votingApprove && sdm.voteBtnLoading]}
            onPress={() => onVote(item.id, true)}
            disabled={votingApprove || votingReject}
            activeOpacity={0.8}
          >
            {votingApprove ? (
              <ActivityIndicator size="small" color="#16A34A" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                <Text style={sdm.approveText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </SafeAreaView>
    </Modal>
  );
}

const sdm = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  scrollContent: { paddingBottom: 16 },

  // Photos
  photoScroll: { maxHeight: 220 },
  photoStrip: { paddingHorizontal: 16, gap: 8, paddingVertical: 14 },
  photo: { width: 280, height: 190, borderRadius: 12, backgroundColor: COLORS.border },
  photoPlaceholder: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photoPlaceholderText: { fontSize: 13, color: COLORS.textTertiary },

  // Meta
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 10, flexWrap: 'wrap' },
  kindPill: {
    backgroundColor: COLORS.primary + '18',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  kindText: { color: COLORS.primary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tierText: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600' },
  timeAgo: { fontSize: 11, color: COLORS.textTertiary, fontWeight: '500' },

  // Name
  spotName: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.4, paddingHorizontal: 16, marginBottom: 10 },

  // Scores
  scoreRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  scorePill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  scoreNum: { fontWeight: '700', fontSize: 13 },

  // Info block
  infoBlock: {
    marginHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  infoIconWrap: { width: 22, alignItems: 'center', paddingTop: 2 },
  infoLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.text, lineHeight: 20 },

  // Detailed rates
  ratesBlock: {
    marginHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 12,
    marginBottom: 14,
  },
  blockLabel: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7 },
  rateRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rateIcon: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rateLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  rateValue: { fontSize: 13, fontWeight: '600', color: COLORS.text, lineHeight: 18 },
  penaltiesBlock: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, paddingTop: 12, gap: 4 },
  penaltyText: { fontSize: 12, color: COLORS.danger, fontWeight: '600' },
  noteText: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },

  // Vote bar
  voteBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  voteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 12,
    paddingVertical: 15,
  },
  voteBtnLoading: { opacity: 0.6 },
  rejectBtn: { backgroundColor: '#FEE2E2' },
  approveBtn: { backgroundColor: '#DCFCE7' },
  rejectText: { color: '#DC2626', fontWeight: '700', fontSize: 15 },
  approveText: { color: '#16A34A', fontWeight: '700', fontSize: 15 },
});

function QueueCard({
  item,
  onPress,
}: {
  item: ModerationQueueItem;
  onPress: () => void;
}) {
  const spot = item.payload?.spot as
    | { name?: string; type?: string; rates?: string; operatingHours?: string }
    | undefined;

  return (
    <TouchableOpacity style={mds.card} onPress={onPress} activeOpacity={0.75}>
      <View style={mds.cardTop}>
        <View style={mds.kindPill}>
          <Text style={mds.kindText}>{item.kind.replace(/_/g, ' ')}</Text>
        </View>
        <Text style={mds.submitterText}>
          {item.submitterTier ?? 'pigeon'} contributor · {timeAgo(item.createdAt)}
        </Text>
      </View>

      <Text style={mds.spotName}>{spot?.name ?? 'Unnamed spot'}</Text>
      {(spot?.type || spot?.rates || spot?.operatingHours) && (
        <Text style={mds.spotMeta}>
          {[spot.type?.replace('_', ' '), spot.rates, spot.operatingHours]
            .filter(Boolean)
            .join('  ·  ')}
        </Text>
      )}

      <View style={mds.cardFooter}>
        <View style={mds.scoreRow}>
          <View style={[mds.scorePill, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="checkmark" size={12} color="#16A34A" />
            <Text style={[mds.scoreNum, { color: '#16A34A' }]}>{item.approvalScore}</Text>
          </View>
          <View style={[mds.scorePill, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="close" size={12} color="#DC2626" />
            <Text style={[mds.scoreNum, { color: '#DC2626' }]}>{item.rejectionScore}</Text>
          </View>
        </View>
        <View style={mds.reviewCta}>
          <Text style={mds.reviewCtaText}>Review</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ModerationSection() {
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<ModerationQueueItem | null>(null);
  const [votingApprove, setVotingApprove] = useState(false);
  const [votingReject, setVotingReject] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery<ModerationQueuePage>({
    queryKey: ['moderation-queue', page],
    queryFn: () => moderationApi.queue(page),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  async function handleVote(itemId: string, approve: boolean) {
    if (approve) setVotingApprove(true);
    else setVotingReject(true);
    try {
      await moderationApi.vote(itemId, approve);
      setSelectedItem(null);
      await refetch();
    } catch {
      Alert.alert('Error', 'Could not cast vote. Please try again.');
    } finally {
      setVotingApprove(false);
      setVotingReject(false);
    }
  }

  return (
    <View style={mds.wrap}>
      <SpotDetailModal
        item={selectedItem}
        visible={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onVote={handleVote}
        votingApprove={votingApprove}
        votingReject={votingReject}
      />

      {/* Header row */}
      <View style={mds.headerRow}>
        <Text style={mds.sectionTitle}>Moderation Queue</Text>
        {total > 0 && (
          <Text style={mds.totalBadge}>{total} pending</Text>
        )}
      </View>

      {isLoading ? (
        <View style={mds.stateCard}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={mds.stateText}>Loading queue…</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={mds.stateCard}>
          <Ionicons name="checkmark-circle-outline" size={32} color={COLORS.success} />
          <Text style={mds.emptyTitle}>Queue is clear</Text>
          <Text style={mds.emptyBody}>No submissions pending review. Check back later.</Text>
        </View>
      ) : (
        <>
          {/* Card list */}
          <View style={mds.list}>
            {items.map((item) => (
              <QueueCard
                key={item.id}
                item={item}
                onPress={() => setSelectedItem(item)}
              />
            ))}
          </View>

          {/* Pagination controls */}
          <View style={mds.pagination}>
            <TouchableOpacity
              style={[mds.pageBtn, page === 1 && mds.pageBtnDisabled]}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isFetching}
              activeOpacity={0.7}
            >
              <Text style={[mds.pageBtnText, page === 1 && mds.pageBtnTextDisabled]}>← Prev</Text>
            </TouchableOpacity>

            <Text style={mds.pageIndicator}>
              Page {page} of {totalPages}
            </Text>

            <TouchableOpacity
              style={[mds.pageBtn, page === totalPages && mds.pageBtnDisabled]}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || isFetching}
              activeOpacity={0.7}
            >
              <Text style={[mds.pageBtnText, page === totalPages && mds.pageBtnTextDisabled]}>Next →</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const mds = StyleSheet.create({
  wrap: { marginTop: 14 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  totalBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    backgroundColor: COLORS.primary + '18',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  stateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stateText: { color: COLORS.textSecondary, fontSize: 13 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptyBody: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },
  list: { gap: 10 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kindPill: {
    backgroundColor: COLORS.primary + '18',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  kindText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  submitterText: { fontSize: 12, color: COLORS.textSecondary },
  spotName: { fontSize: 18, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  spotMeta: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scorePill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  scoreNum: { fontWeight: '800', fontSize: 13 },
  voteRow: { flexDirection: 'row', gap: 10 },
  voteBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  rejectBtn: { backgroundColor: '#FEE2E2' },
  approveBtn: { backgroundColor: '#DCFCE7' },
  rejectText: { color: '#DC2626', fontWeight: '700', fontSize: 14 },
  approveText: { color: '#16A34A', fontWeight: '700', fontSize: 14 },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  pageBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pageBtnDisabled: {
    opacity: 0.35,
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  pageBtnTextDisabled: {
    color: COLORS.textSecondary,
  },
  pageIndicator: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  reviewCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
});

// ─── Landing View ─────────────────────────────────────────────────────────────

function LandingView({ onStart, refreshing, onRefresh }: { onStart: () => void; refreshing: boolean; onRefresh: () => void }) {
  return (
    <ScrollView
      contentContainerStyle={lv.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Hero CTA */}
      <TouchableOpacity style={lv.heroCard} onPress={onStart} activeOpacity={0.88}>
        <View style={lv.heroIcon}>
          <Text style={lv.heroPlus}>+</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={lv.heroTitle}>Add a Parking Spot</Text>
          <Text style={lv.heroSub}>
            Help the community find parking — earn points toward Hawk tier
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>

      <ModerationSection />
    </ScrollView>
  );
}

const lv = StyleSheet.create({
  scroll: { padding: 20 },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 6,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlus: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  heroTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 18 },
  heroArrow: { color: 'rgba(255,255,255,0.6)', fontSize: 22 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ContributeScreen() {
  const { coords, hasPermission } = useLocation();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['moderation-queue'] });
    setRefreshing(false);
  }

  // Wizard navigation
  const [wizardActive, setWizardActive] = useState(false);
  const [step, setStep] = useState(0);
  const [succeeded, setSucceeded] = useState(false);

  // Step 0 — Location
  const [pinCoord, setPinCoord] = useState<Coord | null>(null);
  const [nearbySpots, setNearbySpots] = useState<ParkingSpot[]>([]);
  const [checkingNearby, setCheckingNearby] = useState(false);

  // Step 1 — Details
  const [name, setName] = useState('');
  const [type, setType] = useState<ParkingType>('street');
  const [isPaid, setIsPaid] = useState(false);
  const [hourlyRate, setHourlyRate] = useState('');
  const [detailedRates, setDetailedRates] = useState<DetailedRates | null>(null);
  const [is24Hours, setIs24Hours] = useState(true);
  const [openTime, setOpenTime] = useState('7:00 AM');
  const [closeTime, setCloseTime] = useState('10:00 PM');
  const [landmark, setLandmark] = useState('');

  // Step 2 — Photos
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  // Submit
  const [submitting, setSubmitting] = useState(false);

  // Nearby spot check — debounced on pin move
  useEffect(() => {
    if (!pinCoord) {
      setNearbySpots([]);
      return;
    }
    const t = setTimeout(async () => {
      setCheckingNearby(true);
      try {
        const spots = await parkingApi.getNearby(pinCoord.latitude, pinCoord.longitude, 150);
        setNearbySpots(Array.isArray(spots) ? spots : []);
      } catch {
        setNearbySpots([]);
      } finally {
        setCheckingNearby(false);
      }
    }, 650);
    return () => clearTimeout(t);
  }, [pinCoord?.latitude, pinCoord?.longitude]);

  function resetWizard() {
    setStep(0);
    setPinCoord(null);
    setNearbySpots([]);
    setName('');
    setType('street');
    setIsPaid(false);
    setHourlyRate('');
    setDetailedRates(null);
    setIs24Hours(true);
    setOpenTime('7:00 AM');
    setCloseTime('10:00 PM');
    setLandmark('');
    setPhotos([]);
    setSucceeded(false);
    setWizardActive(false);
  }

  async function handleAddPhotos() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow photo library access in Settings to add photos.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as any,
        allowsMultipleSelection: true,
        quality: 0.85,
      });

      if (!result.assets?.length) return;

      const newItems: PhotoItem[] = result.assets.map((asset) => ({
        id: genId(),
        uri: asset.uri,
        storagePath: null,
        uploading: true,
        error: false,
      }));

      setPhotos((prev) => [...prev, ...newItems]);

      // Upload all in parallel — each photo's success/failure is independent
      await Promise.all(
        newItems.map(async (item) => {
          try {
            const { uploadUrl, storagePath } = await uploadsApi.createParkingPhotoUpload({
              contentType: 'image/jpeg',
              fileExt: 'jpg',
            });
            await uploadAsync(uploadUrl, item.uri, {
              httpMethod: 'PUT',
              uploadType: FileSystemUploadType.BINARY_CONTENT,
              headers: { 'Content-Type': 'image/jpeg' },
            });
            setPhotos((prev) =>
              prev.map((p) =>
                p.id === item.id ? { ...p, storagePath, uploading: false } : p,
              ),
            );
          } catch (uploadErr: any) {
            console.warn('Photo upload failed:', uploadErr?.message ?? uploadErr);
            setPhotos((prev) =>
              prev.map((p) =>
                p.id === item.id ? { ...p, uploading: false, error: true } : p,
              ),
            );
          }
        }),
      );
    } catch (err: any) {
      console.error('handleAddPhotos error:', err);
      Alert.alert('Could not open photos', err?.message ?? 'Something went wrong. Please try again.');
    }
  }

  function handleRemovePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleRetryPhoto(id: string) {
    const photo = photos.find((p) => p.id === id);
    if (!photo) return;
    setPhotos((prev) => prev.map((p) => p.id === id ? { ...p, uploading: true, error: false } : p));
    try {
      const { uploadUrl, storagePath } = await uploadsApi.createParkingPhotoUpload({
        contentType: 'image/jpeg',
        fileExt: 'jpg',
      });
      await uploadAsync(uploadUrl, photo.uri, {
        httpMethod: 'PUT',
        uploadType: FileSystemUploadType.BINARY_CONTENT,
        headers: { 'Content-Type': 'image/jpeg' },
      });
      setPhotos((prev) => prev.map((p) => p.id === id ? { ...p, storagePath, uploading: false } : p));
    } catch (err: any) {
      console.warn('Photo retry failed:', err?.message ?? err);
      setPhotos((prev) => prev.map((p) => p.id === id ? { ...p, uploading: false, error: true } : p));
    }
  }

  async function handleSubmit() {
    if (!pinCoord || !coords) return;
    const storagePaths = photos
      .filter((p) => p.storagePath && !p.error)
      .map((p) => p.storagePath!);
    if (!storagePaths.length) return;

    setSubmitting(true);
    try {
      await communityParkingApi.submitNewPlace({
        name: name.trim(),
        latitude: pinCoord.latitude,
        longitude: pinCoord.longitude,
        type,
        rates: isPaid && hourlyRate ? `₱${hourlyRate}/hr` : isPaid ? 'Paid' : 'Free',
        detailedRates: detailedRates ?? undefined,
        operatingHours: is24Hours
          ? '24h'
          : `${to24h(openTime.trim())}-${to24h(closeTime.trim())}`,
        landmark: landmark.trim() || undefined,
        photoStoragePaths: storagePaths,
        submissionLatitude: coords.latitude,
        submissionLongitude: coords.longitude,
      });
      setSucceeded(true);
    } catch (err: any) {
      const raw = err?.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join('\n') : (raw ?? 'Something went wrong. Please try again.');
      Alert.alert('Submission Failed', msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!wizardActive) {
    return (
      <SafeAreaView style={main.container} edges={['top']}>
        <View style={main.header}>
          <Text style={main.title}>Contribute</Text>
          <Text style={main.subtitle}>Add spots · Review submissions</Text>
        </View>
        <LandingView onStart={() => { setWizardActive(true); setStep(0); }} refreshing={refreshing} onRefresh={onRefresh} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={main.container} edges={['top']}>
      {succeeded ? (
        <SuccessScreen onDone={resetWizard} />
      ) : (
        <>
          <StepIndicator step={step} />
          {step === 0 && (
            <LocationStep
              userCoord={coords}
              hasPermission={hasPermission}
              pinCoord={pinCoord}
              setPinCoord={setPinCoord}
              nearbySpots={nearbySpots}
              checkingNearby={checkingNearby}
              onNext={() => setStep(1)}
              onCancel={resetWizard}
            />
          )}
          {step === 1 && (
            <DetailsStep
              name={name} setName={setName}
              type={type} setType={setType}
              isPaid={isPaid} setIsPaid={setIsPaid}
              hourlyRate={hourlyRate} setHourlyRate={setHourlyRate}
              detailedRates={detailedRates} setDetailedRates={setDetailedRates}
              is24Hours={is24Hours} setIs24Hours={setIs24Hours}
              openTime={openTime} setOpenTime={setOpenTime}
              closeTime={closeTime} setCloseTime={setCloseTime}
              landmark={landmark} setLandmark={setLandmark}
              onBack={() => setStep(0)}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <PhotosStep
              photos={photos}
              onAddPhotos={handleAddPhotos}
              onRemovePhoto={handleRemovePhoto}
              onRetryPhoto={handleRetryPhoto}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && pinCoord && (
            <ConfirmStep
              pinCoord={pinCoord}
              name={name} type={type}
              isPaid={isPaid} hourlyRate={hourlyRate} detailedRates={detailedRates}
              is24Hours={is24Hours} openTime={openTime} closeTime={closeTime}
              landmark={landmark} photos={photos}
              submitting={submitting}
              onBack={() => setStep(2)}
              onSubmit={handleSubmit}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const main = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
});
