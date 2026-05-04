import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { COLORS } from '../../constants';

interface Props {
  selected: boolean;
}

export default function ParkingMarker({ selected }: Props) {
  const size = selected ? 52 : 40;

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
            backgroundColor: selected ? COLORS.primary + '35' : 'transparent',
          },
        ]}
      >
        <Image
          source={require('../../assets/logo.png')}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            opacity: selected ? 1 : 0.85,
          }}
          resizeMode="contain"
        />
      </View>

      {/* Pin stem */}
      <View style={[styles.stem, selected && styles.stemSelected]} />
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
