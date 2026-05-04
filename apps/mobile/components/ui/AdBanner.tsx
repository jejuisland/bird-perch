import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../constants';

const ADS = [
  {
    logo: '🅿',
    title: 'SM Mall Parking',
    sub: 'Reserve your slot in advance — skip the queue',
    cta: 'Reserve',
  },
  {
    logo: '🚗',
    title: 'ParkSmart Premium',
    sub: 'Unlimited parking searches + spot alerts',
    cta: 'Try Free',
  },
  {
    logo: '🛡',
    title: 'AutoSure Insurance',
    sub: 'Protect your vehicle from P99/month',
    cta: 'Get Quote',
  },
];

export default function AdBanner() {
  const [adIndex] = useState(() => Math.floor(Math.random() * ADS.length));
  const ad = ADS[adIndex];

  return (
    <View style={styles.container}>
      <View style={styles.sponsoredTag}>
        <Text style={styles.sponsoredText}>Ad</Text>
      </View>

      <View style={styles.logoBox}>
        <Text style={styles.logo}>{ad.logo}</Text>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>{ad.title}</Text>
        <Text style={styles.sub} numberOfLines={1}>{ad.sub}</Text>
      </View>

      <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.8}>
        <Text style={styles.ctaText}>{ad.cta}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  sponsoredTag: {
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  sponsoredText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { fontSize: 18 },
  copy: { flex: 1 },
  title: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  sub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  ctaBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ctaText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});
