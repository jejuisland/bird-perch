import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ViewStyle } from 'react-native';
import { useMapStore } from '../../store/mapStore';
import { COLORS } from '../../constants';

export default function OpenNowToggle({ style }: { style?: ViewStyle }) {
  const { openNow, toggleOpenNow } = useMapStore();

  return (
    <TouchableOpacity
      style={[styles.chip, openNow && styles.chipActive, style]}
      onPress={toggleOpenNow}
      activeOpacity={0.8}
    >
      <Text style={styles.icon}>{openNow ? '🟢' : '⚪'}</Text>
      <View>
        <Text style={[styles.label, openNow && styles.labelActive]}>Open Now</Text>
        <Text style={[styles.sub, openNow && styles.subActive]}>
          {openNow ? 'Showing open spots' : 'Tap to filter open spots'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  chipActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  icon: { fontSize: 14 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  labelActive: { color: '#14532D' },
  sub: { fontSize: 10, color: COLORS.textSecondary },
  subActive: { color: '#15803D' },
});
