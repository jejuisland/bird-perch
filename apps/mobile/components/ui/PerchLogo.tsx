import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants';

interface Props {
  showTagline?: boolean;
}

export default function PerchLogo({ showTagline = false }: Props) {
  return (
    <View style={styles.wrapper}>

      {/* Outer glow ring */}
      <View style={styles.badgeOuter}>

        {/* Blue circle badge */}
        <View style={styles.badge}>

          {/* Bird row: scan arrow — owl body — scan arrow */}
          <View style={styles.birdRow}>

            <Text style={styles.scanLeft}>‹</Text>

            <View style={styles.birdBody}>
              {/* Ear tufts */}
              <View style={styles.tuftsRow}>
                <View style={styles.tuft} />
                <View style={[styles.tuft, { marginLeft: 10 }]} />
              </View>

              {/* Eyes — pupils looking outward */}
              <View style={styles.eyesRow}>
                <View style={styles.eye}>
                  <View style={styles.pupilLeft} />
                </View>
                <View style={[styles.eye, { marginLeft: 6 }]}>
                  <View style={styles.pupilRight} />
                </View>
              </View>

              {/* Beak */}
              <View style={styles.beak} />
            </View>

            <Text style={styles.scanRight}>›</Text>
          </View>

          {/* Talons / feet connecting bird to branch */}
          <View style={styles.feetRow}>
            <View style={styles.foot} />
            <View style={[styles.foot, { marginLeft: 12 }]} />
          </View>

          {/* Branch — the bird is perching on this */}
          <View style={styles.branchWrapper}>
            {/* Main branch bar */}
            <View style={styles.branch}>
              {/* Wood grain highlight */}
              <View style={styles.branchHighlight} />
            </View>
            {/* Left twig stub */}
            <View style={[styles.twig, styles.twigLeft]} />
            {/* Right twig stub */}
            <View style={[styles.twig, styles.twigRight]} />
          </View>

        </View>
      </View>

      {/* Wordmark */}
      <Text style={styles.brand}>Perch</Text>
      {showTagline && (
        <Text style={styles.tagline}>Our bird always finds a slot.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },

  // Outer glow ring
  badgeOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  // Main blue circle badge — column layout to stack bird + feet + branch
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    gap: 0,
  },

  // Row containing scan arrows + owl body
  birdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  scanLeft: {
    color: '#BFDBFE',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 2,
  },
  scanRight: {
    color: '#BFDBFE',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 2,
  },

  // Owl body assembled from primitives
  birdBody: {
    alignItems: 'center',
  },
  tuftsRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  tuft: {
    width: 5,
    height: 7,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: '#fff',
  },
  eyesRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  eye: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pupilLeft: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1E3A8A',
    marginRight: 4,
  },
  pupilRight: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1E3A8A',
    marginLeft: 4,
  },
  beak: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FCD34D',
  },

  // Talons — thin lines bridging owl to branch
  feetRow: {
    flexDirection: 'row',
    marginTop: 3,
  },
  foot: {
    width: 3,
    height: 8,
    backgroundColor: '#93C5FD',
    borderRadius: 2,
  },

  // Branch the owl is perching on
  branchWrapper: {
    alignItems: 'center',
    marginTop: 1,
  },
  branch: {
    width: 54,
    height: 8,
    backgroundColor: '#5D3A1A',
    borderRadius: 4,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  branchHighlight: {
    height: 2,
    backgroundColor: '#A0522D',
    borderRadius: 2,
    marginHorizontal: 4,
    marginTop: 1,
  },
  // Small twig stubs jutting out from each end
  twig: {
    position: 'absolute',
    width: 10,
    height: 4,
    backgroundColor: '#5D3A1A',
    borderRadius: 2,
    top: 2,
  },
  twigLeft: {
    left: -6,
    transform: [{ rotate: '-20deg' }],
  },
  twigRight: {
    right: -6,
    transform: [{ rotate: '20deg' }],
  },

  // Wordmark
  brand: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});
