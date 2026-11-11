import { fromISODate, type ISODate } from './dates';
import { SESSION_INFO, type DayStatus, type DayType } from './schedule';

export interface ReminderSettings {
  enabled: boolean;
  /** Horas del día en formato HH:MM, ordenadas. */
  times: string[];
}

export const DEFAULT_REMINDERS: ReminderSettings = { enabled: true, times: ['09:00', '10:00', '12:00'] };
export const MAX_REMINDERS_PER_DAY = 3;
export const REMINDER_PREFIX = 'rem-';

export interface Reminder {
  id: string;
  at: Date;
  title: string;
  body: string;
}

export function parseTime(t: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h < 24 && m < 60 ? { h, m } : null;
}

export function shiftTime(t: string, minutes: number): string {
  const p = parseTime(t) ?? { h: 9, m: 0 };
  const total = (((p.h * 60 + p.m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const MESSAGES = [
  (title: string) => `Hoy toca ${title}: unos 15 minutos en casa.`,
  (title: string) => `¿Sacas ahora los 15 minutos de ${title}?`,
  (title: string) => `Último aviso: ${title} sigue pendiente. Si hoy no puedes, márcalo en la app.`,
];

/**
 * Avisos a programar: solo días de sesión en casa sin registrar, hasta 3 por día,
 * y solo los que aún no han pasado. Al registrar la sesión o pulsar «Hoy no», el día deja de estar pendiente.
 */
export function planReminders(
  days: { date: ISODate; type: DayType; status: DayStatus }[],
  settings: ReminderSettings,
  now: Date,
): Reminder[] {
  if (!settings.enabled) return [];
  const times = settings.times
    .map(parseTime)
    .filter((t): t is { h: number; m: number } => t !== null)
    .sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m))
    .slice(0, MAX_REMINDERS_PER_DAY);

  const out: Reminder[] = [];
  for (const d of days) {
    if (d.type === 'gym' || d.type === 'rest') continue;
    if (d.status !== 'pending' && d.status !== 'future') continue;
    const title = SESSION_INFO[d.type].title;
    times.forEach((t, i) => {
      const at = fromISODate(d.date);
      at.setHours(t.h, t.m, 0, 0);
      if (at <= now) return;
      out.push({
        id: `${REMINDER_PREFIX}${d.date}-${i}`,
        at,
        title: i === 0 ? `Sesión de casa · ${title}` : title,
        body: MESSAGES[Math.min(i, MESSAGES.length - 1)](title.toLowerCase()),
      });
    });
  }
  return out;
}
