import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useMapStore } from '../../store/mapStore';
import { COLORS } from '../../constants';

const PRESETS = [
  { label: '1 km', value: 1000 },
  { label: '3 km', value: 3000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
];

export default function RadiusSelector() {
  const { radiusMeters, setRadius } = useMapStore();
  const [expanded, setExpanded] = useState(false);

  const currentLabel = PRESETS.find((p) => p.value === radiusMeters)?.label ?? `${radiusMeters / 1000} km`;

  const handleSelect = (value: number) => {
    setRadius(value);
    setExpanded(false);
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {/* Options panel — shown above the trigger button when expanded */}
      {expanded && (
        <View style={styles.panel}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.value}
              style={[styles.option, radiusMeters === p.value && styles.optionActive]}
              onPress={() => handleSelect(p.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.optionText, radiusMeters === p.value && styles.optionTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Trigger button */}
      <TouchableOpacity
        style={[styles.btn, expanded && styles.btnExpanded]}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}
      >
        <Text style={styles.icon}>📍</Text>
        <Text style={styles.label}>{currentLabel}</Text>
        <Text style={[styles.chevron, expanded && styles.chevronUp]}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 186,
    right: 16,
    alignItems: 'flex-end',
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
    minWidth: 90,
  },
  option: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  optionActive: { backgroundColor: COLORS.primary },
  optionText: { fontSize: 14, fontWeight: '500', color: COLORS.text, textAlign: 'center' },
  optionTextActive: { color: '#fff', fontWeight: '700' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnExpanded: { borderColor: COLORS.primary, borderWidth: 1.5 },
  icon: { fontSize: 14 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  chevron: { fontSize: 16, color: COLORS.textSecondary, transform: [{ rotate: '90deg' }] },
  chevronUp: { transform: [{ rotate: '-90deg' }] },
});
