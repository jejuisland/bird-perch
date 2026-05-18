import React from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { COLORS } from '../../constants';

interface Props {
  selected: boolean;
  unverified?: boolean;
}

export default function ParkingMarker({ selected, unverified }: Props) {
  const size = selected ? 52 : 40;
  const pinColor = unverified ? '#9CA3AF' : COLORS.primary;
  const ringColor = selected ? (unverified ? 'rgba(156, 163, 175, 0.25)' : COLORS.primary + '35') : 'transparent';

  return (
    <View style={styles.wrapper}>
      {/* Glow ring when selected */}
      <View
        style={[
          styles.ring,
          {
            width: size + 10,
            height: size + 10,
            borderRadius: (size + 10) / 2,
            backgroundColor: ringColor,
          },
        ]}
      >
        {unverified ? (
          <View style={styles.unverifiedBadge}>
            <Text style={styles.unverifiedText}>Unverified</Text>
          </View>
        ) : null}
        <Image
          source={require('../../assets/logo.png')}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            opacity: unverified ? 0.55 : selected ? 1 : 0.85,
          }}
          resizeMode="contain"
        />
      </View>

      {/* Pin stem */}
      <View
        style={[
          styles.stem,
          selected && styles.stemSelected,
          { borderTopColor: pinColor },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  unverifiedBadge: {
    position: 'absolute',
    top: -18,
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    zIndex: 2,
  },
  unverifiedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  stem: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.primary,
    marginTop: -1,
  },
  stemSelected: {
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
  },
});
