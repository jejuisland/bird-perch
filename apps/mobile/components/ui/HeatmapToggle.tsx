import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ViewStyle } from 'react-native';
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
      <Text style={styles.icon}>🔥</Text>
      <View>
        <Text style={[styles.label, heatmapEnabled && styles.labelActive]}>Heatmap</Text>
        <Text style={[styles.sub, heatmapEnabled && styles.subActive]}>
          {heatmapEnabled ? 'Showing crowd data' : 'Tap to show crowd data'}
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
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  icon: { fontSize: 14 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  labelActive: { color: '#92400E' },
  sub: { fontSize: 10, color: COLORS.textSecondary, marginTop: 0 },
  subActive: { color: '#B45309' },
});
