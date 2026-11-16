/**
 * Volumen semanal por grupo muscular: series que trabajan cada músculo.
 * Una serie cuenta 1 para el músculo principal del ejercicio y 0,5 para los que ayudan.
 */
export type MuscleGroup = 'pecho' | 'biceps' | 'espalda' | 'hombro' | 'triceps' | 'antebrazo' | 'muslo' | 'cadera' | 'pantorrilla';

export const GROUP_LABEL: Record<MuscleGroup, string> = {
  pecho: 'Pecho',
  biceps: 'Bíceps',
  espalda: 'Espalda',
  hombro: 'Hombro',
  triceps: 'Tríceps',
  antebrazo: 'Antebrazo',
  muslo: 'Muslo y glúteo',
  cadera: 'Aductores y glúteo medio',
  pantorrilla: 'Gemelo y tibial',
};

/** Tren inferior: se entrena para aguantar la marcha y no se compara con la zona de hipertrofia. */
export const LOWER_GROUPS: MuscleGroup[] = ['muslo', 'cadera', 'pantorrilla'];

/** Prioridades del usuario primero. */
export const GROUP_ORDER: MuscleGroup[] = ['pecho', 'biceps', 'espalda', 'hombro', 'triceps', 'antebrazo', 'muslo', 'cadera', 'pantorrilla'];

/** Zona orientativa para ganar músculo: unas 10–20 series semanales por grupo. */
export const HYPERTROPHY_RANGE = { min: 10, max: 20 } as const;

type Share = Partial<Record<MuscleGroup, 1 | 0.5>>;

export const EXERCISE_MUSCLES: Record<string, Share> = {
  dominada_supina: { biceps: 1, espalda: 1, antebrazo: 0.5 },
  dominada_neutra: { biceps: 1, espalda: 1, antebrazo: 0.5 },
  negativa_dominada: { espalda: 1, biceps: 0.5 },
  colgarse: { antebrazo: 1 },
  remo_mancuerna: { espalda: 1, biceps: 0.5 },
  curl_concentrado: { biceps: 1 },
  curl_martillo: { biceps: 1, antebrazo: 0.5 },
  curl_muneca: { antebrazo: 1 },
  curl_muneca_inverso: { antebrazo: 1 },
  flexion_estricta: { pecho: 1, triceps: 0.5, hombro: 0.5 },
  flexion_inclinada: { pecho: 1, triceps: 0.5 },
  flexion_pica: { hombro: 1, triceps: 0.5 },
  press_militar_una_mano: { hombro: 1, triceps: 0.5 },
  pajaros: { hombro: 1, espalda: 0.5 },
  remo_invertido: { espalda: 1, biceps: 0.5 },
  remo_toalla: { espalda: 1, biceps: 0.5, antebrazo: 0.5 },
  remo_mochila: { espalda: 1, biceps: 0.5 },
  curl_mochila: { biceps: 1 },
  press_mochila: { hombro: 1, triceps: 0.5 },
  curl_isometrico_toalla: { biceps: 1, antebrazo: 0.5 },
  agarre_toalla: { antebrazo: 1 },
  elevaciones_yt: { hombro: 1, espalda: 0.5 },
  elevacion_tibial: { pantorrilla: 1 },
  elevacion_talones: { pantorrilla: 1 },
  plancha_copenhague: { cadera: 1 },
  abduccion_cadera: { cadera: 1 },
  zancada_estatica: { muslo: 1 },
  peso_muerto_una_pierna: { muslo: 1 },
};

export function weeklyVolume(sets: readonly { exerciseId: string; sets: number }[]): Record<MuscleGroup, number> {
  const out: Record<MuscleGroup, number> = { pecho: 0, biceps: 0, espalda: 0, hombro: 0, triceps: 0, antebrazo: 0, muslo: 0, cadera: 0, pantorrilla: 0 };
  for (const s of sets) {
    const share = EXERCISE_MUSCLES[s.exerciseId];
    if (!share) continue;
    for (const [g, w] of Object.entries(share) as [MuscleGroup, number][]) out[g] += s.sets * w;
  }
  return out;
}

export function volumeVerdict(sets: number): { label: string; tone: 'low' | 'good' | 'warn' } {
  if (sets < HYPERTROPHY_RANGE.min) return { label: 'Por debajo', tone: 'low' };
  if (sets <= HYPERTROPHY_RANGE.max) return { label: 'En zona', tone: 'good' };
  return { label: 'Mucho volumen', tone: 'warn' };
}
