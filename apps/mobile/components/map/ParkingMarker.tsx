import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../constants';

interface Props {
  selected: boolean;
}

export default function ParkingMarker({ selected }: Props) {
  const badgeSize = selected ? 48 : 38;
  const borderRadius = badgeSize / 2;

  return (
    <View style={styles.wrapper}>
      {/* Outer glow ring */}
      <View
        style={[
          styles.outerRing,
          {
            width: badgeSize + 10,
            height: badgeSize + 10,
            borderRadius: (badgeSize + 10) / 2,
            backgroundColor: selected ? COLORS.primary + '30' : COLORS.primary + '18',
          },
        ]}
      >
        {/* Main badge circle */}
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius,
              shadowOpacity: selected ? 0.45 : 0.2,
              elevation: selected ? 10 : 4,
            },
          ]}
        >
          {/* Ear tufts */}
          <View style={styles.tuftsRow}>
            <View style={[styles.tuft, selected && styles.tuftLg]} />
            <View style={[styles.tuft, styles.tuftRight, selected && styles.tuftLg]} />
          </View>

          {/* Eyes */}
          <View style={styles.eyesRow}>
            {selected ? (
              <>
                {/* Open eyes — white circles with dark pupils */}
                <View style={styles.eyeOpen}>
                  <View style={styles.pupilLeft} />
                </View>
                <View style={styles.eyeOpen}>
                  <View style={styles.pupilRight} />
                </View>
              </>
            ) : (
              <>
                {/* Closed eyes — arc squint lines */}
                <View style={styles.eyeClosed} />
                <View style={styles.eyeClosed} />
              </>
            )}
          </View>

          {/* Beak */}
          <View style={[styles.beak, selected && styles.beakLg]} />
        </View>
      </View>

      {/* Pin stem triangle pointing down */}
      <View style={[styles.stem, selected && styles.stemSelected]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },

  outerRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  badge: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    gap: 2,
    paddingTop: 4,
  },

  // Ear tufts
  tuftsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 1,
  },
  tuft: {
    width: 4,
    height: 6,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    backgroundColor: '#fff',
  },
  tuftRight: {
    // no extra style needed, gap handles spacing
  },
  tuftLg: {
    width: 5,
    height: 7,
  },

  // Eyes row
  eyesRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },

  // Open eye
  eyeOpen: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pupilLeft: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#1E3A8A',
    marginRight: 3,
  },
  pupilRight: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#1E3A8A',
    marginLeft: 3,
  },

  // Closed eye — thin arc (flat bottom semicircle)
  eyeClosed: {
    width: 11,
    height: 5,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: '#fff',
  },

  // Beak
  beak: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FCD34D',
  },
  beakLg: {
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
  },

  // Pin stem
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
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 11,
  },
});
