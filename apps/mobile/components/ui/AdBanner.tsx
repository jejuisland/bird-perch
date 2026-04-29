import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants';

// Ad banner placeholder — max ~8-10% screen height, non-intrusive (PRD §5.5)
export default function AdBanner() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Advertisement</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 56,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  text: { color: COLORS.textSecondary, fontSize: 13 },
});
