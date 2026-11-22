import { BigShoulders_800ExtraBold } from '@expo-google-fonts/big-shoulders';
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans';
import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import type { SQLiteDatabase } from 'expo-sqlite';

import { loadEventConfig } from '@/db/event';
import { DB_NAME, migrate } from '@/db/schema';
import { dailySnapshot, writeSnapshot } from '@/db/snapshots';
import { beforeLeaving } from '@/google/auth';
import { DriveAutoBackup } from '@/google/DriveAutoBackup';
import { ReminderSync } from '@/notifications/ReminderSync';
import { colors, fonts, navTheme } from '@/ui/theme';
import { installWebAlert } from '@/ui/webAlert';

installWebAlert();

const isLocked = (e: Error) => /Access Handle|another open/i.test(e.message);
/** Veces que se reintenta abrir la base de datos si el navegador aún no la ha soltado. */
const OPEN_RETRIES = 5;

/** Prepara la base de datos y carga la fecha y los objetivos de la prueba antes de pintar nada. */
async function init(db: SQLiteDatabase) {
  // En el navegador no existen las transacciones exclusivas: se usa la normal, que allí basta
  // porque solo hay una pestaña con la base de datos abierta. Sigue siendo todo o nada.
  if (Platform.OS === 'web') {
    db.withExclusiveTransactionAsync = (task) => db.withTransactionAsync(() => task(db as never));
  }
  // Antes de cambiar la estructura de la base de datos se guarda una copia tal como estaba.
  await migrate(db, { beforeUpgrade: (from) => writeSnapshot(db, `antes-v${from}`) });
  await loadEventConfig(db);
  // Y una copia al día, sin esperar a que termine ni dejar que un fallo bloquee la app.
  dailySnapshot(db).catch((e) => console.warn('No se pudo guardar la copia diaria', e));
}

/**
 * En el navegador, la base de datos es un archivo que solo puede tener abierto una página a la vez.
 * Se cierra al salir de la página (y antes de ir a Google) para que la siguiente pueda abrirlo.
 */
function ReleaseDatabaseOnLeave() {
  const db = useSQLiteContext();
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const close = () => db.closeAsync().catch(() => {});
    const off = beforeLeaving(close);
    window.addEventListener('pagehide', close);
    return () => {
      off();
      window.removeEventListener('pagehide', close);
    };
  }, [db]);
  return null;
}

/** Pantalla que se ve si la base de datos no se puede abrir, en vez de un error en crudo. */
function DatabaseError({ error }: { error: Error }) {
  const locked = isLocked(error);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 20, textAlign: 'center' }}>
        {locked ? 'La app ya está abierta en otra pestaña' : 'No se han podido abrir tus datos'}
      </Text>
      <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, textAlign: 'center' }}>
        {locked
          ? 'En el navegador solo puede estar abierta en una pestaña a la vez. Cierra las demás y vuelve a cargar esta. Tus datos están intactos.'
          : `Tus datos no se han tocado. Cierra la app y vuelve a abrirla. Si sigue pasando, este es el detalle: ${error.message}`}
      </Text>
      {Platform.OS === 'web' && (
        <Pressable
          accessibilityRole="button"
          onPress={() => window.location.reload()}
          style={{ backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 24, minHeight: 48 }}>
          <Text style={{ color: colors.onAccent, fontFamily: fonts.bold, fontSize: 16 }}>Volver a cargar</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function RootLayout() {
  const [dbError, setDbError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Al cambiar de página en el navegador, la anterior tarda un instante en soltar el archivo de la
  // base de datos. Antes de dar el error se reintenta unas cuantas veces.
  const retrying = Platform.OS === 'web' && dbError != null && isLocked(dbError) && attempt < OPEN_RETRIES;
  useEffect(() => {
    if (!retrying) return;
    const t = setTimeout(() => {
      setDbError(null);
      setAttempt((a) => a + 1);
    }, 700);
    return () => clearTimeout(t);
  }, [retrying]);
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
  if (retrying) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (dbError) return <DatabaseError error={dbError} />;

  return (
    <SQLiteProvider key={attempt} databaseName={DB_NAME} onInit={init} onError={setDbError}>
      <ThemeProvider value={navTheme}>
        <StatusBar style="light" />
        <ReminderSync />
        <ReleaseDatabaseOnLeave />
        <DriveAutoBackup />
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
