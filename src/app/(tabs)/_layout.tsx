import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';

import { colors } from '@/ui/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoy',
          tabBarIcon: ({ color, size }) => <Ionicons name="flame" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="semana"
        options={{
          title: 'Semana',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="progreso"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" size={size} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
