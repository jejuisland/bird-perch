import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../../constants';

interface Props {
  spotName: string;
  distanceM: number;
  durationSec: number;
  isRerouting: boolean;
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function formatDuration(sec: number): string {
  const mins = Math.ceil(sec / 60);
  if (mins < 60) return `~${mins} min`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `~${h}h ${rem}m` : `~${h}h`;
}

export default function NavigationBanner({ spotName, distanceM, durationSec, isRerouting }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isRerouting) {
      pulse.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [isRerouting]);

  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Text style={styles.icon}>🚗</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{spotName}</Text>
        {isRerouting ? (
          <Animated.Text style={[styles.sub, { opacity: pulse }]}>↻  Re-routing…</Animated.Text>
        ) : (
          <Text style={styles.sub}>
            {formatDistance(distanceM)}  ·  {formatDuration(durationSec)} drive
          </Text>
        )}
      </View>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>{formatDistance(distanceM)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 18 },
  info: { flex: 1 },
  name: { fontSize: 13, fontWeight: '700', color: '#fff' },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});
