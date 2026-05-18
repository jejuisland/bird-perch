import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
      <Ionicons
        name={openNow ? 'checkmark-circle' : 'time-outline'}
        size={15}
        color={openNow ? COLORS.success : COLORS.textSecondary}
      />
      <Text style={[styles.label, openNow && styles.labelActive]}>Open Now</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.background,
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
    backgroundColor: COLORS.successLight,
    borderColor: COLORS.success,
  },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  labelActive: { color: COLORS.success },
});
