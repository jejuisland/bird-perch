import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMapStore } from '../../store/mapStore';
import { COLORS } from '../../constants';

interface Props {
  userLocation: { latitude: number; longitude: number } | null;
}

export default function ParkHereButton({ userLocation }: Props) {
  const { parkedLocation, parkCar } = useMapStore();

  const isParked = !!parkedLocation;

  return (
    <TouchableOpacity
      style={[styles.btn, isParked && styles.btnParked]}
      onPress={() => userLocation && parkCar(userLocation)}
      activeOpacity={0.8}
      disabled={!userLocation}
    >
      <Ionicons name="car-outline" size={16} color={COLORS.textInverse} />
      <Text style={styles.label}>{isParked ? 'Re-park' : 'Park Here'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    bottom: 130,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    gap: 6,
  },
  btnParked: {
    backgroundColor: COLORS.warning,
  },
  label: { color: COLORS.textInverse, fontWeight: '600', fontSize: 13 },
});
