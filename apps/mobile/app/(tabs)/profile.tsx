import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../constants';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{user?.name ?? '—'}</Text>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email ?? '—'}</Text>
        <Text style={styles.label}>Vehicle</Text>
        <Text style={styles.value}>{user?.vehicleType ?? '—'}</Text>
      </View>

      <View style={styles.privacyNote}>
        <Text style={styles.privacyText}>
          Your location data is anonymized and never shared individually.
        </Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 24 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  label: { fontSize: 12, color: COLORS.textSecondary, textTransform: 'uppercase' },
  value: { fontSize: 16, color: COLORS.text, marginBottom: 8 },
  privacyNote: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  privacyText: { fontSize: 13, color: '#1E40AF', lineHeight: 18 },
  logoutBtn: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  logoutText: { color: '#DC2626', fontWeight: '600' },
});
