import { BigShoulders_800ExtraBold } from '@expo-google-fonts/big-shoulders';
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans';
import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import type { SQLiteDatabase } from 'expo-sqlite';

import { loadEventConfig } from '@/db/event';
import { DB_NAME, migrate } from '@/db/schema';
import { dailySnapshot, writeSnapshot } from '@/db/snapshots';
import { ReminderSync } from '@/notifications/ReminderSync';
import { colors, fonts, navTheme } from '@/ui/theme';

/** Prepara la base de datos y carga la fecha y los objetivos de la prueba antes de pintar nada. */
async function init(db: SQLiteDatabase) {
  // Antes de cambiar la estructura de la base de datos se guarda una copia tal como estaba.
  await migrate(db, { beforeUpgrade: (from) => writeSnapshot(db, `antes-v${from}`) });
  await loadEventConfig(db);
  // Y una copia al día, sin esperar a que termine ni dejar que un fallo bloquee la app.
  dailySnapshot(db).catch((e) => console.warn('No se pudo guardar la copia diaria', e));
}

export default function RootLayout() {
  // Las letras se cargan antes de pintar para que el texto no salte de una fuente a otra.
  const [loaded, failed] = useFonts({
    BigShoulders_800ExtraBold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });
  // Si alguna no carga, se sigue con la del sistema antes que dejar la pantalla en blanco.
  if (!loaded && !failed) return null;

  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={init}>
      <ThemeProvider value={navTheme}>
        <StatusBar style="light" />
        <ReminderSync />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily: fonts.bold },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="sesion/[kind]" options={{ title: 'Sesión' }} />
          <Stack.Screen name="gimnasio" options={{ title: 'Gimnasio' }} />
          <Stack.Screen name="test" options={{ title: 'Test de máximo', presentation: 'modal' }} />
          <Stack.Screen name="perfil" options={{ title: 'Perfil y avisos' }} />
          <Stack.Screen name="medicion" options={{ title: 'Medición' }} />
          <Stack.Screen name="flexibilidad" options={{ title: 'Flexibilidad' }} />
          <Stack.Screen name="flexionar" options={{ title: 'Sesión de flexibilidad' }} />
          <Stack.Screen name="flex-test" options={{ title: 'Test de flexibilidad' }} />
          <Stack.Screen name="indicador/[id]" options={{ title: 'Indicador' }} />
          <Stack.Screen name="semana-tipo" options={{ title: 'Semana tipo' }} />
          <Stack.Screen name="dia" options={{ title: 'Cambiar día', presentation: 'modal' }} />
          <Stack.Screen name="viaje" options={{ title: 'Viaje' }} />
          <Stack.Screen name="ejercicio/[id]" options={{ title: 'Ejercicio' }} />
          <Stack.Screen name="fotos" options={{ title: 'Fotos de progreso' }} />
          <Stack.Screen name="marcha" options={{ title: 'Marcha' }} />
          <Stack.Screen name="caminata" options={{ title: 'Caminata' }} />
          <Stack.Screen name="estiramientos" options={{ title: 'Estiramientos' }} />
          <Stack.Screen name="estirar/[rutina]" options={{ title: 'Estirar' }} />
          <Stack.Screen name="revision" options={{ title: 'Revisión semanal' }} />
          <Stack.Screen name="prueba" options={{ title: 'La prueba' }} />
          <Stack.Screen name="dominadas" options={{ title: 'Dominadas' }} />
        </Stack>
      </ThemeProvider>
    </SQLiteProvider>
  );
}
