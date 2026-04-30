import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../constants';
import PerchLogo from '../../components/ui/PerchLogo';

export default function LoginScreen() {
  const { sendOtp } = useAuthStore();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) return Alert.alert('Enter a valid email address.');
    setLoading(true);
    try {
      await sendOtp(trimmed);
      router.push({ pathname: '/(auth)/verify-otp', params: { email: trimmed } });
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'Could not send code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        <View style={styles.logoArea}>
          <PerchLogo showTagline />
        </View>

        <Text style={styles.title}>Sign In</Text>
        <Text style={styles.subtitle}>
          Enter your email and we'll send you a one-time code — no password needed.
        </Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="send"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={handleSendCode}
            autoFocus
          />
          <TouchableOpacity style={styles.btn} onPress={handleSendCode} disabled={loading || !email.trim()}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Get Code →</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, justifyContent: 'center', padding: 28 },
  logoArea: { alignItems: 'center', marginBottom: 36 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 28 },
  form: { gap: 12 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    padding: 16, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.surface,
  },
  btn: {
    backgroundColor: COLORS.primary, borderRadius: 12, padding: 16,
    alignItems: 'center', opacity: 1,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
