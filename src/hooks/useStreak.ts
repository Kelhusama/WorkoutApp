import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { loadDays } from '@/db/repo';
import { addDays, today, weekStart } from '@/domain/dates';
import { tallyWeeks, weekStreak } from '@/domain/insights';
import { adherence, streak } from '@/domain/stats';

export interface StreakInfo {
  current: number;
  best: number;
  /** Sesiones hechas y planificadas en las últimas 4 semanas. */
  done: number;
  planned: number;
  /** Semanas cumplidas seguidas (se permite fallar una sesión por semana). */
  weeks: number;
  bestWeeks: number;
  /** Ya se ha gastado el comodín de esta semana. */
  passUsed: boolean;
}

/** Racha de sesiones y cumplimiento reciente. Se recalcula al volver a la pantalla. */
export function useStreak(): StreakInfo | null {
  const db = useSQLiteContext();
  const [info, setInfo] = useState<StreakInfo | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const end = today();
        const { days } = await loadDays(db, addDays(end, -182), end);
        // Antes de la primera sesión registrada no hay nada que contar como fallo.
        const first = days.findIndex((d) => d.log);
        const counted = first < 0 ? [] : days.slice(first);
        const recent = counted.filter((d) => d.date > addDays(end, -28));
        const w = weekStreak(tallyWeeks(counted), weekStart(end));
        setInfo({ ...streak(counted), ...adherence(recent), weeks: w.current, bestWeeks: w.best, passUsed: w.passUsed });
      })();
    }, [db]),
  );

  return info;
}
