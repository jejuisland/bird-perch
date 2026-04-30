import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useMapStore } from '../../store/mapStore';
import { COLORS } from '../../constants';

export default function OpenNowToggle() {
  const { openNow, toggleOpenNow } = useMapStore();

  return (
    <TouchableOpacity
      style={[styles.btn, openNow && styles.btnActive]}
      onPress={toggleOpenNow}
      activeOpacity={0.8}
    >
      <Text style={[styles.text, openNow && styles.textActive]}>🟢 Open Now</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    bottom: 145,
    left: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnActive: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  text: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  textActive: { color: '#fff' },
});
