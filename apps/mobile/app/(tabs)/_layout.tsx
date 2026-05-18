import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG: Record<string, { label: string; icon: IoniconsName; iconActive: IoniconsName }> = {
  index:      { label: 'Explore',    icon: 'map-outline',        iconActive: 'map'        },
  contribute: { label: 'Contribute', icon: 'add-circle-outline', iconActive: 'add-circle' },
  profile:    { label: 'Profile',    icon: 'person-outline',     iconActive: 'person'     },
};

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const cfg = TAB_CONFIG[route.name];
        if (!cfg) return null;

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            onPress={() => navigation.navigate(route.name)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel={cfg.label}
            accessibilityState={{ selected: isFocused }}
          >
            <Ionicons
              name={isFocused ? cfg.iconActive : cfg.icon}
              size={24}
              color={isFocused ? COLORS.primary : COLORS.textSecondary}
            />
            <Text style={[styles.label, isFocused && styles.labelActive]}>
              {cfg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 8,
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.1,
  },
  labelActive: {
    color: COLORS.primary,
  },
});

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    />
  );
}
