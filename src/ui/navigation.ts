import { router } from 'expo-router';

import type { ISODate } from '@/domain/dates';
import type { DayType } from '@/domain/schedule';

/** Abre la pantalla de registro adecuada para un día. Futuros y descansos no se abren. */
export function openDay(type: DayType, date: ISODate) {
  if (type === 'rest') return;
  if (type === 'gym') {
    router.push({ pathname: '/gimnasio', params: { date } });
  } else {
    router.push({ pathname: '/sesion/[kind]', params: { kind: type, date } });
  }
}
