import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../constants';
import PerchLogo from '../../components/ui/PerchLogo';

type LoginMode = 'otp' | 'password';

export default function LoginScreen() {
  const { sendOtp, loginWithPassword } = useAuthStore();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<LoginMode>('otp');
  const [loading, setLoading] = useState(false);

  const handleOtp = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) return Alert.alert('Invalid email', 'Enter a valid email address.');
    setLoading(true);
    try {
      await sendOtp(trimmed);
      router.push({ pathname: '/(auth)/verify-otp', params: { email: trimmed, mode: 'login' } });
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'Could not send code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePassword = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) return Alert.alert('Invalid email', 'Enter a valid email address.');
    if (password.length < 8) return Alert.alert('Password too short', 'Password must be at least 8 characters.');
    setLoading(true);
    try {
      await loginWithPassword(trimmed, password);
    } catch (e: any) {
      Alert.alert('Sign in failed', e.response?.data?.message ?? 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmitOtp = email.trim().includes('@');
  const canSubmitPassword = email.trim().includes('@') && password.length >= 8;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>

        <View style={styles.logoArea}>
          <PerchLogo showTagline />
        </View>

        {/* Mode toggle */}
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'otp' && styles.modeBtnActive]}
            onPress={() => setMode('otp')}
          >
            <Text style={[styles.modeBtnText, mode === 'otp' && styles.modeBtnTextActive]}>
              Email OTP
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'password' && styles.modeBtnActive]}
            onPress={() => setMode('password')}
          >
            <Text style={[styles.modeBtnText, mode === 'password' && styles.modeBtnTextActive]}>
              Password
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Sign In</Text>
        <Text style={styles.subtitle}>
          {mode === 'otp'
            ? 'Enter your email and we\'ll send a one-time code.'
            : 'Sign in with your email and password.'}
        </Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType={mode === 'otp' ? 'send' : 'next'}
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={mode === 'otp' ? handleOtp : undefined}
            autoFocus
          />

          {mode === 'password' && (
            <TextInput
              style={styles.input}
              placeholder="Password (min 8 characters)"
              placeholderTextColor={COLORS.textSecondary}
              secureTextEntry
              returnKeyType="send"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handlePassword}
            />
          )}

          <TouchableOpacity
            style={[styles.btn, (loading || (mode === 'otp' ? !canSubmitOtp : !canSubmitPassword)) && styles.btnDisabled]}
            onPress={mode === 'otp' ? handleOtp : handlePassword}
            disabled={loading || (mode === 'otp' ? !canSubmitOtp : !canSubmitPassword)}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>
                {mode === 'otp' ? 'Get Code →' : 'Sign In →'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.footerLink}>Register</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, justifyContent: 'center', padding: 28 },
  logoArea: { alignItems: 'center', marginBottom: 32 },

  modeRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
    padding: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  modeBtnActive: {
    backgroundColor: COLORS.primary,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modeBtnTextActive: {
    color: '#fff',
  },

  title: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 24 },

  form: { gap: 12 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    padding: 16, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.surface,
  },
  btn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    padding: 16, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: { color: COLORS.textSecondary, fontSize: 14 },
  footerLink: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
});
