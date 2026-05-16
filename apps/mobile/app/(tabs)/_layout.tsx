import { Tabs } from 'expo-router';
import { COLORS } from '../../constants';

import { Ionicons } from '@expo/vector-icons';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(focusedName: string, unfocusedName: string) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={(focused ? focusedName : unfocusedName) as IoniconsName} size={22} color={color} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 58,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explore',
          tabBarIcon: tabIcon('map', 'map-outline'),
        }}
      />
      <Tabs.Screen
        name="contribute"
        options={{
          title: 'Contribute',
          tabBarIcon: tabIcon('add-circle', 'add-circle-outline'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: tabIcon('person', 'person-outline'),
        }}
      />
    </Tabs>
  );
}
