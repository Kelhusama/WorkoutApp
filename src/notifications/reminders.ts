import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { loadDays } from '@/db/repo';
import { getReminderSettings } from '@/db/settings';
import { addDays, today } from '@/domain/dates';
import { REMINDER_PREFIX, planReminders } from '@/domain/reminders';

const CHANNEL = 'recordatorios';
/** Días por delante que se programan. Se vuelve a calcular cada vez que se abre la app. */
const HORIZON_DAYS = 14;

let configured = false;
let running: Promise<void> = Promise.resolve();

function configure() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Crea el canal de Android y pide permiso (en Android 13+ el aviso solo sale si existe un canal). */
export async function ensurePermission(): Promise<boolean> {
  configure();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Recordatorios de entrenamiento',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function doSync(db: SQLiteDatabase) {
  const settings = await getReminderSettings(db);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(REMINDER_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  if (!settings.enabled) return;
  if (!(await ensurePermission())) return;

  const from = today();
  const { days } = await loadDays(db, from, addDays(from, HORIZON_DAYS - 1));
  for (const r of planReminders(days, settings, new Date())) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: { screen: 'hoy' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: r.at,
        channelId: CHANNEL,
      },
    });
  }
}

/**
 * Vuelve a programar los avisos según el plan y los registros actuales.
 * Se llama al abrir la app y después de cualquier cambio que afecte a si un día está pendiente.
 */
export function syncReminders(db: SQLiteDatabase): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  running = running
    .then(() => doSync(db))
    .catch((e) => console.warn('No se pudieron programar los avisos', e));
  return running;
}
