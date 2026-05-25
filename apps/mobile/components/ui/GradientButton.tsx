import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENTS, SHADOWS } from '../../constants';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Primary call-to-action implementing the scheme's "depth" system: a
 * #3B7BF7 → #1D4ED8 gradient with a blue glow shadow. Falls back to a flat
 * muted fill when disabled.
 */
export default function GradientButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style,
  textStyle,
}: Props) {
  const inactive = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      style={[styles.wrap, !inactive && SHADOWS.primaryGlow, style]}
    >
      {inactive ? (
        <View style={[styles.button, styles.disabled]}>
          {loading ? (
            <ActivityIndicator color={COLORS.textInverse} size="small" />
          ) : (
            <Text style={[styles.label, textStyle]}>{label}</Text>
          )}
        </View>
      ) : (
        <LinearGradient
          colors={GRADIENTS.primaryButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.button}
        >
          <Text style={[styles.label, textStyle]}>{label}</Text>
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 12 },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { backgroundColor: COLORS.primaryMuted },
  label: {
    color: COLORS.textInverse,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
