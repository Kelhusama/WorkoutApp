import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { loadDays } from '@/db/repo';
import { addDays, today } from '@/domain/dates';
import { adherence, streak } from '@/domain/stats';

export interface StreakInfo {
  current: number;
  best: number;
  /** Sesiones hechas y planificadas en las últimas 4 semanas. */
  done: number;
  planned: number;
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
        setInfo({ ...streak(counted), ...adherence(recent) });
      })();
    }, [db]),
  );

  return info;
}
