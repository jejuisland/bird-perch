import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { VehicleType } from '@perch/shared';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../constants';

const VEHICLES: { label: string; value: VehicleType }[] = [
  { label: 'Motorcycle', value: 'motorcycle' },
  { label: 'Sedan', value: 'sedan' },
  { label: 'SUV', value: 'suv' },
  { label: 'Van', value: 'van' },
];

export default function RegisterScreen() {
  const { register } = useAuthStore();
  const [form, setForm] = useState({
    name: '', email: '', password: '', mobileNumber: '', age: '', vehicleType: '' as VehicleType | '',
  });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const update = (key: keyof typeof form) => (val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.vehicleType) return Alert.alert('Please select a vehicle type');
    setLoading(true);
    try {
      await register({ ...form, age: parseInt(form.age) });
    } catch (e: any) {
      Alert.alert('Registration failed', e.response?.data?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Create Account</Text>

        {/* Privacy notice — required by PRD */}
        <View style={styles.privacyBanner}>
          <Text style={styles.privacyText}>
            Your location data is anonymized and never shared individually.
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Name or nickname" value={form.name} onChangeText={update('name')} />
          <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={update('email')} />
          <TextInput style={styles.input} placeholder="Password (min 8 chars)" secureTextEntry value={form.password} onChangeText={update('password')} />
          <TextInput style={styles.input} placeholder="Mobile number" keyboardType="phone-pad" value={form.mobileNumber} onChangeText={update('mobileNumber')} />
          <TextInput style={styles.input} placeholder="Age" keyboardType="number-pad" value={form.age} onChangeText={update('age')} />

          <Text style={styles.sectionLabel}>Vehicle Type</Text>
          <View style={styles.vehicleRow}>
            {VEHICLES.map((v) => (
              <TouchableOpacity
                key={v.value}
                style={[styles.vehicleBtn, form.vehicleType === v.value && styles.vehicleBtnActive]}
                onPress={() => setForm((f) => ({ ...f, vehicleType: v.value }))}
              >
                <Text style={[styles.vehicleLabel, form.vehicleType === v.value && styles.vehicleLabelActive]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
          </TouchableOpacity>
        </View>

        <Link href="/(auth)/login" style={styles.link}>
          Already have an account? <Text style={styles.linkAccent}>Sign In</Text>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 24 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  privacyBanner: { backgroundColor: '#EFF6FF', borderRadius: 8, padding: 12, marginBottom: 20 },
  privacyText: { fontSize: 13, color: '#1E40AF', lineHeight: 18 },
  form: { gap: 12 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14, fontSize: 16, backgroundColor: COLORS.surface },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 8 },
  vehicleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vehicleBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  vehicleBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  vehicleLabel: { color: COLORS.text, fontSize: 14 },
  vehicleLabelActive: { color: '#fff', fontWeight: '600' },
  btn: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', marginTop: 24, marginBottom: 16, color: COLORS.textSecondary },
  linkAccent: { color: COLORS.primary, fontWeight: '600' },
});
