import { Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { DB_NAME, migrate } from '@/db/schema';
import { colors, navTheme } from '@/ui/theme';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
      <ThemeProvider value={navTheme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="sesion/[kind]" options={{ title: 'Sesión' }} />
          <Stack.Screen name="gimnasio" options={{ title: 'Gimnasio' }} />
          <Stack.Screen name="test" options={{ title: 'Test de máximo', presentation: 'modal' }} />
          <Stack.Screen name="perfil" options={{ title: 'Tu perfil' }} />
          <Stack.Screen name="medicion" options={{ title: 'Medición' }} />
          <Stack.Screen name="indicador/[id]" options={{ title: 'Indicador' }} />
        </Stack>
      </ThemeProvider>
    </SQLiteProvider>
  );
}
