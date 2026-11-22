import type { ISODate } from './dates';
import type { SessionKind } from './schedule';
import { CORE_KEYS, LEG_KEYS, TEMPLATES, type Slot, focusSlots } from './templates';

/** Lo que tienes a mano durante un viaje. Sin nada marcado: solo tu cuerpo. */
export interface TravelGear {
  /** A veces hay una mancuerna (o algo que haga de ella): añade remo y curl. */
  mancuerna: boolean;
  /** Gimnasio en el hotel: los días de gimnasio se mantienen y hay barra para las dominadas del plan. */
  gimnasio: boolean;
}

export interface Trip {
  id: number;
  from: ISODate;
  to: ISODate;
  gear: TravelGear;
}

export const NO_GEAR: TravelGear = { mancuerna: false, gimnasio: false };

export function tripOn<T extends { from: ISODate; to: ISODate }>(trips: readonly T[], date: ISODate): T | undefined {
  return trips.find((t) => t.from <= date && date <= t.to);
}

const ALL = Object.values(TEMPLATES).flat();
const home = (key: string): Slot => ALL.find((s) => s.key === key)!;

/**
 * Sesión de viaje: una sola, siempre la misma y sin material. Flexiones y abdomen, que es lo que
 * se puede seguir mejorando sin nada, y dos ejercicios de pierna que rotan según el día.
 * Usa las mismas claves que en casa: la progresión sigue donde estaba.
 * Con una mancuerna se añaden el remo y el curl de casa.
 * Las dominadas no se sustituyen: sin barra se paran y se retoman a la vuelta.
 */
export function travelSlots(kind: SessionKind, gear: TravelGear): Slot[] {
  return [
    home('B.flexiones'),
    home('B.inclinadas'),
    ...(gear.mancuerna ? [home('A.remo'), home('A.curl')] : []),
    home(CORE_KEYS.A),
    home(CORE_KEYS.B),
    ...LEG_KEYS[kind].map(home),
  ];
}

/** Ejercicios de una sesión de casa: los de viaje, los de la sesión enfocada o los normales. */
/** `pullupPlan`: el plan de dominadas de la prueba está activo, así que la sesión enfocada no las repite. */
export function sessionSlots(kind: SessionKind, gear: TravelGear | null | undefined, focus = false, pullupPlan = false): Slot[] {
  return gear ? travelSlots(kind, gear) : focus ? focusSlots(pullupPlan) : TEMPLATES[kind];
}

export function gearSummary(g: TravelGear): string {
  const parts = [g.mancuerna && 'una mancuerna', g.gimnasio && 'gimnasio de hotel'].filter(Boolean);
  return parts.length ? `Con ${parts.join(' y ')}` : 'Sin material';
}
