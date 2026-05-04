import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS } from '../../constants';

interface Props {
  showTagline?: boolean;
  size?: number;
}

export default function PerchLogo({ showTagline = false, size = 100 }: Props) {
  return (
    <View style={styles.wrapper}>
      <Image
        source={require('../../assets/logo.png')}
        style={{ width: size, height: size, resizeMode: 'contain' }}
      />
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
  brand: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: -0.5,
    marginTop: 8,
  },
  tagline: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});
