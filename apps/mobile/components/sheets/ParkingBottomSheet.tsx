import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { ParkingSpot } from '@perch/shared';
import { reviewsApi } from '../../services/api';
import { COLORS } from '../../constants';

interface Props {
  spot: ParkingSpot | null;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  usually_busy: '🔴 Usually Busy',
  usually_available: '🟢 Usually Available',
  unknown: '⚪ Unknown',
};

const TYPE_LABELS: Record<string, string> = {
  street: 'Street Parking',
  mall: 'Mall Parking',
  private_lot: 'Private Lot',
};

function StarRating({ rating, onRate }: { rating: number; onRate?: (r: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <TouchableOpacity key={s} onPress={() => onRate?.(s)} disabled={!onRate}>
          <Text style={{ fontSize: 20, color: s <= rating ? COLORS.star : COLORS.border }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ParkingBottomSheet({ spot, onClose }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['40%', '85%'], []);

  const [reviews, setReviews] = useState<any[]>([]);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (spot) {
      sheetRef.current?.snapToIndex(0);
      reviewsApi.getBySpot(spot.id).then(setReviews).catch(() => {});
    } else {
      sheetRef.current?.close();
    }
  }, [spot]);

  const handleSubmitReview = async () => {
    if (!spot || newRating === 0) return Alert.alert('Please select a star rating');
    setSubmitting(true);
    try {
      await reviewsApi.create(spot.id, { rating: newRating, comment: newComment });
      setNewRating(0);
      setNewComment('');
      const updated = await reviewsApi.getBySpot(spot.id);
      setReviews(updated);
    } catch {
      Alert.alert('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (!spot) return null;

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
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{spot.name}</Text>
            <View style={styles.tagsRow}>
              <Text style={styles.tag}>{TYPE_LABELS[spot.type]}</Text>
              <Text style={styles.status}>{STATUS_LABELS[spot.status]}</Text>
            </View>
          </View>
        </View>

        {/* Rating */}
        <View style={styles.row}>
          <StarRating rating={Math.round(spot.averageRating)} />
          <Text style={styles.ratingText}>
            {spot.averageRating > 0 ? spot.averageRating.toFixed(1) : 'No ratings'} ({spot.reviewCount})
          </Text>
        </View>

        {/* Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailLabel}>Rates</Text>
          <Text style={styles.detailValue}>{spot.rates || 'Not specified'}</Text>
          <Text style={styles.detailLabel}>Hours</Text>
          <Text style={styles.detailValue}>{spot.operatingHours || 'Not specified'}</Text>
        </View>

        {/* Add Review */}
        <Text style={styles.sectionTitle}>Leave a Review</Text>
        <StarRating rating={newRating} onRate={setNewRating} />
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment (optional)"
          value={newComment}
          onChangeText={setNewComment}
          multiline
        />
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitReview} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>Submit</Text>}
        </TouchableOpacity>

        {/* Comments */}
        {reviews.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Reviews</Text>
            {reviews.map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewerName}>{r.user?.name ?? 'Anonymous'}</Text>
                  <StarRating rating={r.rating} />
                </View>
                {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
                <Text style={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString()}</Text>
              </View>
            ))}
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: COLORS.background, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handle: { backgroundColor: COLORS.border, width: 40 },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', marginBottom: 12 },
  name: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  tagsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  tag: { fontSize: 12, color: COLORS.primary, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  status: { fontSize: 12, color: COLORS.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  ratingText: { fontSize: 14, color: COLORS.textSecondary },
  detailsCard: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 14, marginBottom: 20, gap: 4 },
  detailLabel: { fontSize: 11, color: COLORS.textSecondary, textTransform: 'uppercase', marginTop: 8 },
  detailValue: { fontSize: 15, color: COLORS.text },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 10, marginTop: 8 },
  commentInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, minHeight: 70, marginTop: 10, fontSize: 14 },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  submitText: { color: '#fff', fontWeight: '700' },
  reviewCard: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, marginBottom: 10 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  reviewerName: { fontWeight: '600', color: COLORS.text, fontSize: 14 },
  reviewComment: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  reviewDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
});
