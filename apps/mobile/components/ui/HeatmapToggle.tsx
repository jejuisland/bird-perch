import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useMapStore } from '../../store/mapStore';
import { COLORS } from '../../constants';

export default function HeatmapToggle() {
  const { heatmapEnabled, toggleHeatmap } = useMapStore();

  return (
    <TouchableOpacity
      style={[styles.btn, heatmapEnabled && styles.btnActive]}
      onPress={toggleHeatmap}
      activeOpacity={0.8}
    >
      <Text style={[styles.text, heatmapEnabled && styles.textActive]}>🔥 Heatmap</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute', bottom: 90, left: 16,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, backgroundColor: COLORS.background,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  btnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  text: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  textActive: { color: '#fff' },
});
