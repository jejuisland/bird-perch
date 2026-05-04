import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useMapStore } from '../../store/mapStore';

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m away` : `${(m / 1000).toFixed(1)} km away`;
}

function formatWalkTime(m: number): string {
  const mins = Math.ceil(m / 1.4 / 60);
  return `~${mins} min walk`;
}

function formatParkedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  userLocation: { latitude: number; longitude: number } | null;
}

export default function MyCarPanel({ userLocation }: Props) {
  const { parkedLocation, clearParkedCar } = useMapStore();

  if (!parkedLocation) return null;

  const distance =
    userLocation
      ? haversineMeters(
          userLocation.latitude,
          userLocation.longitude,
          parkedLocation.latitude,
          parkedLocation.longitude,
        )
      : null;

  const openNavigation = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${parkedLocation.latitude},${parkedLocation.longitude}`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🚗  My Car</Text>
        <Text style={styles.time}>Parked at {formatParkedAt(parkedLocation.timestamp)}</Text>
      </View>

      {distance !== null && (
        <Text style={styles.distance}>
          {formatDistance(distance)}  ·  {formatWalkTime(distance)}
        </Text>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.navBtn} onPress={openNavigation} activeOpacity={0.8}>
          <Text style={styles.navBtnText}>Navigate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearBtn} onPress={clearParkedCar} activeOpacity={0.8}>
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    bottom: 68,
    left: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#F97316',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: { fontWeight: '700', fontSize: 15, color: '#111827' },
  time: { fontSize: 12, color: '#6B7280' },
  distance: { fontSize: 13, color: '#374151', marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  navBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  navBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  clearBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  clearBtnText: { color: '#EF4444', fontWeight: '600', fontSize: 13 },
});
