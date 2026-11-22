import type { ISODate } from './dates';
import type { SessionKind } from './schedule';
import { CORE_KEYS, LEG_KEYS, TEMPLATES, slot, type Slot, focusSlots } from './templates';

/** Lo que tienes a mano durante un viaje. Sin nada marcado: solo tu cuerpo y una toalla. */
export interface TravelGear {
  /** Mochila cargada con libros o botellas (sustituye a la mancuerna). */
  mochila: boolean;
  /** Mesa robusta para remo invertido (sustituye a la barra). */
  mesa: boolean;
  /** Gimnasio en el hotel: los días de gimnasio se mantienen. */
  gimnasio: boolean;
}

export interface Trip {
  id: number;
  from: ISODate;
  to: ISODate;
  gear: TravelGear;
}

export const NO_GEAR: TravelGear = { mochila: false, mesa: false, gimnasio: false };

export function tripOn<T extends { from: ISODate; to: ISODate }>(trips: readonly T[], date: ISODate): T | undefined {
  return trips.find((t) => t.from <= date && date <= t.to);
}

const TIME = { allowsTempo: false, step: 5 } as const;

/**
 * Sesión de casa adaptada al viaje. Las flexiones y el bloque de pierna conservan su clave para que la progresión siga;
 * el resto usa claves propias (V.…) con sus propios rangos.
 */
export function travelSlots(kind: SessionKind, gear: TravelGear): Slot[] {
  const home = TEMPLATES[kind];
  const keep = (key: string) => home.find((s) => s.key === key)!;
  // Pierna y abdomen no necesitan material. En la sesión C, que en casa usa la barra, se hace la barca.
  const coreKey = kind === 'C' ? CORE_KEYS.A : CORE_KEYS[kind];
  const legs = [...LEG_KEYS[kind].map(keep), Object.values(TEMPLATES).flat().find((s) => s.key === coreKey)!];
  const curl = gear.mochila
    ? slot(`V.${kind}.curl_mochila`, 'curl_mochila', 3, 8, 15, 4)
    : slot(`V.${kind}.curl_iso`, 'curl_isometrico_toalla', 3, 15, 30, 4, TIME);

  if (kind === 'A') {
    return [
      gear.mesa
        ? slot('V.A.remo_invertido', 'remo_invertido', 4, 6, 12, 5, { note: 'Sustituye a las dominadas.' })
        : slot('V.A.remo_toalla', 'remo_toalla', 4, 8, 15, 5, { note: 'Sustituye a las dominadas.' }),
      gear.mochila
        ? slot('V.A.remo_mochila', 'remo_mochila', 3, 10, 15, 4)
        : gear.mesa
          ? slot('V.A.remo_toalla2', 'remo_toalla', 3, 8, 15, 4)
          : slot('V.A.agarre', 'agarre_toalla', 3, 20, 40, 4, TIME),
      curl,
      ...legs,
    ];
  }
  if (kind === 'B') {
    return [keep('B.flexiones'), keep('B.inclinadas'), keep('B.pica'), slot('V.B.agarre', 'agarre_toalla', 2, 20, 40, 3, TIME), ...legs];
  }
  return [
    gear.mesa
      ? slot('V.C.remo_invertido', 'remo_invertido', 3, 5, 8, 4, { note: 'Suave: sin llegar al fallo.' })
      : slot('V.C.remo_toalla', 'remo_toalla', 3, 8, 12, 4, { note: 'Suave: sin llegar al fallo.' }),
    gear.mochila ? slot('V.C.press_mochila', 'press_mochila', 3, 8, 12, 4) : slot('V.C.pica', 'flexion_pica', 3, 5, 8, 4),
    curl,
    slot('V.C.yt', 'elevaciones_yt', 2, 10, 15, 3),
    slot('V.C.agarre', 'agarre_toalla', 2, 20, 40, 3, TIME),
    ...legs,
  ];
}

/** Ejercicios de la sesión: los de casa, o los adaptados si ese día hay viaje. */
/** Ejercicios de una sesión de casa: adaptados al viaje, los de la sesión enfocada o los normales. */
/** `pullupPlan`: el plan de dominadas de la prueba está activo, así que la sesión enfocada no las repite. */
export function sessionSlots(kind: SessionKind, gear: TravelGear | null | undefined, focus = false, pullupPlan = false): Slot[] {
  return gear ? travelSlots(kind, gear) : focus ? focusSlots(pullupPlan) : TEMPLATES[kind];
}

export function gearSummary(g: TravelGear): string {
  const parts = [g.mochila && 'mochila', g.mesa && 'mesa', g.gimnasio && 'gimnasio de hotel'].filter(Boolean);
  return parts.length ? `Con ${parts.join(', ')}` : 'Sin material';
}
