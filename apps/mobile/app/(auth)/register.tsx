import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { VehicleType } from '@perch/shared';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../constants';

// ─── Constants ────────────────────────────────────────────────────────────────

const VEHICLES: { label: string; value: VehicleType; icon: string }[] = [
  { label: 'Motorcycle', value: 'motorcycle', icon: '🏍️' },
  { label: 'Sedan', value: 'sedan', icon: '🚗' },
  { label: 'SUV', value: 'suv', icon: '🚙' },
  { label: 'Van', value: 'van', icon: '🚐' },
];

const CONSENTS = [
  {
    key: 'terms',
    title: 'Terms of Service & Privacy Policy',
    body: 'I have read and agree to the Perch Terms of Service and Privacy Policy.',
  },
  {
    key: 'location',
    title: 'Location Access',
    body: 'I consent to Perch collecting my real-time GPS location to show nearby parking spots, enable navigation to a selected spot, and guide me back to my parked vehicle.',
  },
  {
    key: 'heatmap',
    title: 'Anonymous Heatmap Data',
    body: 'I consent to Perch collecting anonymized location data (not linked to my account) to generate community parking heatmaps that help other drivers find available spaces.',
  },
  {
    key: 'vehicle',
    title: 'Vehicle Information',
    body: 'I consent to storing my vehicle type to personalise parking spot recommendations and filter results relevant to my vehicle.',
  },
  {
    key: 'contact',
    title: 'Contact & Account Data',
    body: 'I consent to Perch storing my email address for OTP authentication and my mobile number (optional) for account notifications. This data is never sold to third parties.',
  },
];

// ─── Checkbox ─────────────────────────────────────────────────────────────────

function Checkbox({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity onPress={onToggle} style={styles.checkboxWrapper} activeOpacity={0.7}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─── Step 1: Terms & Conditions ───────────────────────────────────────────────

function TermsStep({ onAccept, onBack }: { onAccept: () => void; onBack: () => void }) {
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(CONSENTS.map((c) => [c.key, false])),
  );
  const allChecked = CONSENTS.every((c) => checked[c.key]);
  const toggle = (key: string) => setChecked((p) => ({ ...p, [key]: !p[key] }));

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Terms & Conditions</Text>
        <Text style={styles.subtitle}>
          Please review and accept each item to continue registration.
        </Text>

        <View style={styles.termsCard}>
          <Text style={styles.termsIntro}>
            Perch is a community-driven parking discovery app. We collect certain data to power
            our features. Your data is used solely within Perch and is never sold to third parties.
          </Text>
        </View>

        {CONSENTS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.consentRow, checked[item.key] && styles.consentRowChecked]}
            onPress={() => toggle(item.key)}
            activeOpacity={0.85}
          >
            <Checkbox checked={checked[item.key]} onToggle={() => toggle(item.key)} />
            <View style={styles.consentText}>
              <Text style={styles.consentTitle}>{item.title}</Text>
              <Text style={styles.consentBody}>{item.body}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <Text style={styles.acceptNote}>
          You must accept all items above to create a Perch account.
        </Text>

        <TouchableOpacity
          style={[styles.btn, !allChecked && styles.btnDisabled]}
          onPress={onAccept}
          disabled={!allChecked}
        >
          <Text style={styles.btnText}>Accept & Continue →</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Step 2: Profile & Submit ─────────────────────────────────────────────────

function ProfileStep({ onBack }: { onBack: () => void }) {
  const { register } = useAuthStore();
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    email: '',
    mobileNumber: '',
    age: '',
    vehicleType: '' as VehicleType | '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleRegister = async () => {
    const email = form.email.trim().toLowerCase();
    if (!form.name.trim()) return Alert.alert('Name required', 'Please enter your name.');
    if (!email.includes('@')) return Alert.alert('Invalid email', 'Enter a valid email address.');
    if (!form.vehicleType) return Alert.alert('Vehicle required', 'Please select your vehicle type.');
    const age = parseInt(form.age);
    if (!form.age || isNaN(age) || age < 16 || age > 100)
      return Alert.alert('Invalid age', 'Enter a valid age between 16 and 100.');
    if (showPassword) {
      if (form.password.length < 8)
        return Alert.alert('Password too short', 'Password must be at least 8 characters.');
      if (form.password !== form.confirmPassword)
        return Alert.alert('Password mismatch', 'Passwords do not match.');
    }

    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        email,
        mobileNumber: form.mobileNumber.trim() || undefined,
        age,
        vehicleType: form.vehicleType,
        password: showPassword ? form.password : undefined,
      });
      router.push({ pathname: '/(auth)/verify-otp', params: { email, mode: 'register' } });
    } catch (e: any) {
      Alert.alert('Registration failed', e.response?.data?.message ?? 'Could not register. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>
          Fill in your details. A verification code will be sent to your email.
        </Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Full name or nickname"
            placeholderTextColor={COLORS.textSecondary}
            value={form.name}
            onChangeText={update('name')}
          />
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            value={form.email}
            onChangeText={update('email')}
          />
          <TextInput
            style={styles.input}
            placeholder="Mobile number (optional)"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="phone-pad"
            value={form.mobileNumber}
            onChangeText={update('mobileNumber')}
          />
          <TextInput
            style={styles.input}
            placeholder="Age"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="number-pad"
            value={form.age}
            onChangeText={update('age')}
          />

          <Text style={styles.sectionLabel}>Your Vehicle</Text>
          <View style={styles.vehicleRow}>
            {VEHICLES.map((v) => (
              <TouchableOpacity
                key={v.value}
                style={[styles.vehicleBtn, form.vehicleType === v.value && styles.vehicleBtnActive]}
                onPress={() => setForm((f) => ({ ...f, vehicleType: v.value }))}
              >
                <Text style={styles.vehicleIcon}>{v.icon}</Text>
                <Text style={[styles.vehicleLabel, form.vehicleType === v.value && styles.vehicleLabelActive]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Optional password section */}
          <TouchableOpacity
            style={styles.passwordToggleRow}
            onPress={() => setShowPassword((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, showPassword && styles.checkboxChecked]}>
              {showPassword && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.passwordToggleText}>
              Set a password (optional — for password-based login)
            </Text>
          </TouchableOpacity>

          {showPassword && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Password (min 8 characters)"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry
                value={form.password}
                onChangeText={update('password')}
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry
                value={form.confirmPassword}
                onChangeText={update('confirmPassword')}
              />
            </>
          )}

          <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Register & Send Code →</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Root: step controller ─────────────────────────────────────────────────────

export default function RegisterScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'terms' | 'profile'>('terms');

  if (step === 'terms') {
    return (
      <TermsStep
        onAccept={() => setStep('profile')}
        onBack={() => router.replace('/(auth)/login')}
      />
    );
  }
  return <ProfileStep onBack={() => setStep('terms')} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 24, paddingBottom: 40 },

  back: { marginBottom: 16, alignSelf: 'flex-start' },
  backText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },

  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 20 },

  // T&C
  termsCard: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 16,
  },
  termsIntro: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  consentRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    padding: 14, marginBottom: 10, backgroundColor: COLORS.surface,
  },
  consentRowChecked: { borderColor: COLORS.primary, backgroundColor: '#EFF6FF' },
  checkboxWrapper: { paddingTop: 2 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  consentText: { flex: 1 },
  consentTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  consentBody: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
  acceptNote: {
    fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginVertical: 12,
  },

  // Profile form
  form: { gap: 12 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    padding: 14, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.surface,
  },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 4 },
  vehicleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vehicleBtn: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', gap: 4,
    minWidth: '45%', flex: 1,
  },
  vehicleBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  vehicleIcon: { fontSize: 22 },
  vehicleLabel: { color: COLORS.text, fontSize: 13, fontWeight: '500' },
  vehicleLabelActive: { color: '#fff', fontWeight: '600' },

  passwordToggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 4, marginTop: 4,
  },
  passwordToggleText: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 18 },

  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  loginText: { color: COLORS.textSecondary, fontSize: 14 },
  loginLink: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },

  // Shared
  btn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { backgroundColor: COLORS.border },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
