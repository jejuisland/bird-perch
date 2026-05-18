import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMapStore } from '../../store/mapStore';
import { COLORS } from '../../constants';

export default function HeatmapToggle({ style }: { style?: ViewStyle }) {
  const { heatmapEnabled, toggleHeatmap } = useMapStore();

  return (
    <TouchableOpacity
      style={[styles.chip, heatmapEnabled && styles.chipActive, style]}
      onPress={toggleHeatmap}
      activeOpacity={0.8}
    >
      <Ionicons
        name="flame-outline"
        size={15}
        color={heatmapEnabled ? COLORS.warning : COLORS.textSecondary}
      />
      <Text style={[styles.label, heatmapEnabled && styles.labelActive]}>Heatmap</Text>
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
    backgroundColor: COLORS.warningLight,
    borderColor: COLORS.warning,
  },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  labelActive: { color: COLORS.warningText },
});
