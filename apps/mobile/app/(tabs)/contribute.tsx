import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { useQuery } from '@tanstack/react-query';
import { COLORS, OSM_TILE_URL } from '../../constants';
import { useLocation } from '../../hooks/useLocation';
import {
  communityParkingApi,
  moderationApi,
  uploadsApi,
  parkingApi,
} from '../../services/api';
import type { ParkingType, ParkingSpot, ModerationQueueItem } from '@perch/shared';
import { v4 as uuidv4 } from 'uuid';

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
                <Text style={si.check}>✓</Text>
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
  dotDone: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  check: { color: '#fff', fontSize: 11, fontWeight: '800' },
  num: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  numActive: { color: '#fff' },
  label: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', letterSpacing: 0.2 },
  labelActive: { color: COLORS.primary },
  line: { flex: 1, height: 1.5, backgroundColor: COLORS.border, marginBottom: 14, marginHorizontal: 3 },
  lineDone: { backgroundColor: '#16A34A' },
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
        <Text style={ls.permIcon}>📍</Text>
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
            <Text style={ls.warnTitle}>⚠️  Spot found {closestDist}m away</Text>
            <Text style={ls.warnSub}>
              "{closestSpot.name}" is already here. Is this a different spot?
            </Text>
          </>
        ) : (
          <Text style={ls.okText}>✓  No duplicates found — good to go</Text>
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
  permIcon: { fontSize: 52 },
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
  warnTitle: { fontSize: 14, fontWeight: '700', color: '#D97706' },
  warnSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 },
  okText: { fontSize: 14, fontWeight: '700', color: '#16A34A' },
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
  is24Hours: boolean; setIs24Hours: (v: boolean) => void;
  openTime: string; setOpenTime: (v: string) => void;
  closeTime: string; setCloseTime: (v: string) => void;
  landmark: string; setLandmark: (v: string) => void;
  onBack: () => void; onNext: () => void;
}) {
  const canNext = name.trim().length >= 2;
  const showNameHint = name.trim().length > 0 && name.trim().length < 2;

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
  onBack,
  onNext,
}: {
  photos: PhotoItem[];
  onAddPhotos: () => void;
  onRemovePhoto: (id: string) => void;
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
            <Text style={ps.tipTitle}>📸  What makes a good photo?</Text>
            <Text style={ps.tipChevron}>{tipOpen ? '▲' : '▼'}</Text>
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
                  <View style={[ps.overlay, ps.overlayError]}>
                    <Text style={ps.errorMark}>!</Text>
                  </View>
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
                    <Text style={ps.checkMark}>✓</Text>
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
              Some photos failed to upload. Remove the red ones and try again.
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
  tipChevron: { fontSize: 10, color: COLORS.textSecondary },
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
  errorMark: { color: '#fff', fontSize: 24, fontWeight: '800' },
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
  checkMark: { color: '#fff', fontSize: 9, fontWeight: '800' },
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
  name, type, isPaid, hourlyRate,
  is24Hours, openTime, closeTime, landmark,
  photos, submitting,
  onBack, onSubmit,
}: {
  pinCoord: Coord;
  name: string; type: ParkingType;
  isPaid: boolean; hourlyRate: string;
  is24Hours: boolean; openTime: string; closeTime: string;
  landmark: string; photos: PhotoItem[];
  submitting: boolean; onBack: () => void; onSubmit: () => void;
}) {
  const readyPhotos = photos.filter((p) => p.storagePath && !p.error);
  const costLabel = isPaid ? (hourlyRate ? `₱${hourlyRate} / hour` : 'Paid (rate TBC)') : 'Free';
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
          <Text style={cs.infoIcon}>🏘️</Text>
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
  infoIcon: { fontSize: 22 },
  infoTitle: { fontSize: 14, fontWeight: '800', color: '#1E40AF' },
  infoBody: { fontSize: 13, color: '#1E40AF', lineHeight: 18 },
});

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({ onDone }: { onDone: () => void }) {
  return (
    <View style={suc.wrap}>
      <View style={suc.iconWrap}>
        <Text style={suc.iconText}>✓</Text>
      </View>
      <Text style={suc.title}>Spot submitted!</Text>
      <Text style={suc.body}>
        Your spot is in the community review queue. Once it's verified, you'll earn points
        toward Hawk tier.
      </Text>
      <View style={suc.pointBadge}>
        <Text style={suc.pointText}>🐦  +10 points when verified</Text>
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
  iconText: { fontSize: 38, color: '#16A34A' },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  body: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  pointBadge: {
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

function ModerationSection() {
  const [voting, setVoting] = useState(false);
  const [queueIndex, setQueueIndex] = useState(0);

  const { data: queue, isLoading, refetch } = useQuery({
    queryKey: ['moderation-queue'],
    queryFn: () => moderationApi.queue(),
    staleTime: 30_000,
  });

  const current = queue?.[queueIndex] ?? null;
  const spot = current?.payload?.spot as
    | { name?: string; type?: string; rates?: string; operatingHours?: string }
    | undefined;

  async function vote(approve: boolean) {
    if (!current) return;
    setVoting(true);
    try {
      await moderationApi.vote(current.id, approve);
      const next = queueIndex + 1;
      if (next < (queue?.length ?? 0)) {
        setQueueIndex(next);
      } else {
        setQueueIndex(0);
        await refetch();
      }
    } catch {
      Alert.alert('Error', 'Could not cast vote. Please try again.');
    } finally {
      setVoting(false);
    }
  }

  return (
    <View style={mds.wrap}>
      <Text style={mds.sectionTitle}>Moderation Queue</Text>

      {isLoading ? (
        <View style={mds.stateCard}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={mds.stateText}>Loading queue…</Text>
        </View>
      ) : !current ? (
        <View style={mds.stateCard}>
          <Text style={mds.emptyIcon}>✓</Text>
          <Text style={mds.emptyTitle}>Queue is clear</Text>
          <Text style={mds.emptyBody}>No submissions pending review. Check back later.</Text>
        </View>
      ) : (
        <View style={mds.card}>
          {/* Kind badge + submitter */}
          <View style={mds.cardTop}>
            <View style={mds.kindPill}>
              <Text style={mds.kindText}>
                {current.kind.replace(/_/g, ' ')}
              </Text>
            </View>
            <Text style={mds.submitterText}>
              by {(current as any).submitterTier ?? 'pigeon'} contributor
            </Text>
          </View>

          {/* Spot name + meta */}
          <Text style={mds.spotName}>{spot?.name ?? 'Unnamed spot'}</Text>
          {(spot?.type || spot?.rates || spot?.operatingHours) && (
            <Text style={mds.spotMeta}>
              {[
                spot.type?.replace('_', ' '),
                spot.rates,
                spot.operatingHours,
              ]
                .filter(Boolean)
                .join('  ·  ')}
            </Text>
          )}

          {/* Vote scores */}
          <View style={mds.scoreRow}>
            <View style={[mds.scorePill, { backgroundColor: '#DCFCE7' }]}>
              <Text style={[mds.scoreNum, { color: '#16A34A' }]}>
                ✓  {current.approvalScore}
              </Text>
            </View>
            <View style={[mds.scorePill, { backgroundColor: '#FEE2E2' }]}>
              <Text style={[mds.scoreNum, { color: '#DC2626' }]}>
                ✗  {current.rejectionScore}
              </Text>
            </View>
            <Text style={mds.queueCount}>
              {queue?.length ?? 0} in queue
            </Text>
          </View>

          {/* Approve / Reject */}
          <View style={mds.voteRow}>
            <TouchableOpacity
              style={[mds.voteBtn, mds.rejectBtn]}
              onPress={() => vote(false)}
              disabled={voting}
              activeOpacity={0.8}
            >
              {voting ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Text style={mds.rejectText}>✗  Reject</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[mds.voteBtn, mds.approveBtn]}
              onPress={() => vote(true)}
              disabled={voting}
              activeOpacity={0.8}
            >
              {voting ? (
                <ActivityIndicator size="small" color="#16A34A" />
              ) : (
                <Text style={mds.approveText}>✓  Approve</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const mds = StyleSheet.create({
  wrap: { marginTop: 14 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 10,
    letterSpacing: -0.2,
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
  emptyIcon: { fontSize: 28, color: '#16A34A' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptyBody: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },
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
  scorePill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  scoreNum: { fontWeight: '800', fontSize: 13 },
  queueCount: { fontSize: 12, color: COLORS.textSecondary, marginLeft: 'auto' },
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
});

// ─── Landing View ─────────────────────────────────────────────────────────────

function LandingView({ onStart }: { onStart: () => void }) {
  return (
    <ScrollView
      contentContainerStyle={lv.scroll}
      showsVerticalScrollIndicator={false}
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
        <Text style={lv.heroArrow}>›</Text>
      </TouchableOpacity>

      <ModerationSection />

      <View style={{ height: 32 }} />
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
        const spots = await parkingApi.getNearby(pinCoord.latitude, pinCoord.longitude, 60);
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
    setIs24Hours(true);
    setOpenTime('7:00 AM');
    setCloseTime('10:00 PM');
    setLandmark('');
    setPhotos([]);
    setSucceeded(false);
    setWizardActive(false);
  }

  async function handleAddPhotos() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission Required',
        'Please allow photo library access in Settings to add photos.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) return;

    const newItems: PhotoItem[] = result.assets.map((asset) => ({
      id: uuidv4(),
      uri: asset.uri,
      storagePath: null,
      uploading: true,
      error: false,
    }));

    setPhotos((prev) => [...prev, ...newItems]);

    // Upload all in parallel
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
        } catch {
          setPhotos((prev) =>
            prev.map((p) =>
              p.id === item.id ? { ...p, uploading: false, error: true } : p,
            ),
          );
        }
      }),
    );
  }

  function handleRemovePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
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
        operatingHours: is24Hours
          ? '24 hours'
          : `${openTime.trim()}–${closeTime.trim()}`,
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
        <LandingView onStart={() => { setWizardActive(true); setStep(0); }} />
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
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && pinCoord && (
            <ConfirmStep
              pinCoord={pinCoord}
              name={name} type={type}
              isPaid={isPaid} hourlyRate={hourlyRate}
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
