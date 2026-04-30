import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { VehicleType } from '@perch/shared';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../constants';

const VEHICLES: { label: string; value: VehicleType; icon: string }[] = [
  { label: 'Motorcycle', value: 'motorcycle', icon: '🏍️' },
  { label: 'Sedan', value: 'sedan', icon: '🚗' },
  { label: 'SUV', value: 'suv', icon: '🚙' },
  { label: 'Van', value: 'van', icon: '🚐' },
];

export default function CompleteProfileScreen() {
  const { completeProfile } = useAuthStore();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', mobileNumber: '', age: '', vehicleType: '' as VehicleType | '',
  });
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return Alert.alert('Please enter your name.');
    if (!form.vehicleType) return Alert.alert('Please select a vehicle type.');
    const age = parseInt(form.age);
    if (!form.age || isNaN(age) || age < 16 || age > 100) return Alert.alert('Enter a valid age (16–100).');

    setLoading(true);
    try {
      await completeProfile({
        name: form.name.trim(),
        mobileNumber: form.mobileNumber.trim(),
        age,
        vehicleType: form.vehicleType,
      });
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message ?? 'Could not save profile. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>Just a few details so Perch can personalise your experience.</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Name or nickname"
            placeholderTextColor={COLORS.textSecondary}
            value={form.name}
            onChangeText={update('name')}
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

          <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Let's Go →</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 24 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginTop: 16, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 28 },
  form: { gap: 12 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    padding: 14, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.surface,
  },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 8 },
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
  btn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 12,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
