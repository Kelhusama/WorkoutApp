import { router } from 'expo-router';

import type { ISODate } from '@/domain/dates';
import type { DayType } from '@/domain/schedule';

/** Abre la pantalla adecuada para un día. Futuros y descansos no se abren. `focus`: sesión de casa enfocada. */
export function openDay(type: DayType, date: ISODate, focus = false) {
  if (type === 'rest') return;
  if (type === 'movilidad') {
    router.push('/flexibilidad');
    return;
  }
  if (type === 'gym') {
    router.push({ pathname: '/gimnasio', params: { date } });
  } else {
    router.push({ pathname: '/sesion/[kind]', params: focus ? { kind: type, date, focus: '1' } : { kind: type, date } });
  }
}
