import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font } from '@/ui/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.faint,
        // Alto fijo con sitio para icono y nombre: con el alto por defecto el nombre se cortaba.
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border, height: 72 + insets.bottom, paddingTop: 6, paddingBottom: 6 + insets.bottom },
        // Cada pestaña con alto propio: si no, el nombre se sale de su caja y se recorta por abajo.
        tabBarItemStyle: { height: 60 },
        // 11 puntos y sin aire extra entre letras: «Calendario» tiene que caber entero en un móvil de 360 de ancho.
        tabBarLabelStyle: { fontSize: 11, lineHeight: 16, fontFamily: font.w600.fontFamily },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoy',
          tabBarIcon: ({ color, size }) => <Ionicons name="flame" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="entrenar"
        options={{
          title: 'Entrenar',
          tabBarIcon: ({ color, size }) => <Ionicons name="fitness" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="calendario"
        options={{
          title: 'Calendario',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="cuerpo"
        options={{
          title: 'Cuerpo',
          tabBarIcon: ({ color, size }) => <Ionicons name="body" size={size} color={color as string} />,
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
