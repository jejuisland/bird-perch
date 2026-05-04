import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../constants';

function formatSeconds(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

export default function VerifyOtpScreen() {
  const { email, mode } = useLocalSearchParams<{ email: string; mode: 'login' | 'register' }>();
  const { sendOtp, verifyOtp } = useAuthStore();
  const router = useRouter();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [resendCooldown, setResendCooldown] = useState(60);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const { isNewUser } = await verifyOtp(email!, code.trim());

      if (mode === 'register') {
        // Registration complete — profile is already filled, go straight to app
        router.replace('/(tabs)');
      } else {
        // Login OTP — go to tabs; AuthGuard will redirect to register if profile incomplete
        if (isNewUser) {
          router.replace('/(auth)/register');
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch (e: any) {
      const msg = e.response?.data?.message ?? 'Invalid or expired code.';
      Alert.alert('Verification failed', msg);
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return;
    setResending(true);
    try {
      await sendOtp(email);
      setSecondsLeft(600);
      setResendCooldown(60);
      setCode('');
      Alert.alert('Code sent!', 'A new code has been sent to your email.');
    } catch {
      Alert.alert('Error', 'Could not resend. Try again.');
    } finally {
      setResending(false);
    }
  };

  const isRegistration = mode === 'register';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          {isRegistration ? 'Verify Your Email' : 'Check your email'}
        </Text>
        <Text style={styles.subtitle}>
          {isRegistration
            ? 'We sent a 6-digit code to confirm your registration.'
            : 'We sent a 6-digit sign-in code to'}
          {'\n'}
          <Text style={styles.emailText}>{email}</Text>
        </Text>

        <TextInput
          style={styles.codeInput}
          placeholder="000000"
          placeholderTextColor={COLORS.border}
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
          autoFocus
          textAlign="center"
          returnKeyType="done"
          onSubmitEditing={handleVerify}
        />

        {secondsLeft > 0 && (
          <Text style={styles.timer}>Code expires in {formatSeconds(secondsLeft)}</Text>
        )}

        <TouchableOpacity
          style={[styles.btn, (loading || code.length !== 6) && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={loading || code.length !== 6}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>
              {isRegistration ? 'Verify & Create Account' : 'Verify'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleResend}
          disabled={resendCooldown > 0 || resending}
          style={styles.resendRow}
        >
          <Text style={[styles.resendText, resendCooldown > 0 && styles.resendDisabled]}>
            {resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : resending
              ? 'Sending...'
              : 'Resend Code'}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, padding: 28, justifyContent: 'center' },
  back: { position: 'absolute', top: 16, left: 28 },
  backText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 32 },
  emailText: { color: COLORS.text, fontWeight: '600' },
  codeInput: {
    borderWidth: 2, borderColor: COLORS.primary, borderRadius: 14,
    padding: 20, fontSize: 32, fontWeight: '700', letterSpacing: 10,
    color: COLORS.text, backgroundColor: COLORS.surface, marginBottom: 12,
  },
  timer: { textAlign: 'center', fontSize: 13, color: COLORS.textSecondary, marginBottom: 20 },
  btn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    padding: 16, alignItems: 'center', marginBottom: 16,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  resendRow: { alignItems: 'center' },
  resendText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  resendDisabled: { color: COLORS.textSecondary },
});
