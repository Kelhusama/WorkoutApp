import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { loadDays, type PlannedDay } from '@/db/repo';
import { addDays, weekStart, type ISODate } from '@/domain/dates';
import { DEFAULT_TEMPLATE, type WeekTemplate } from '@/domain/schedule';

export type { PlannedDay };

/** Días planificados con su estado entre dos fechas (incluidas). Se recarga al volver a la pantalla. */
export function useDays(from: ISODate, to: ISODate) {
  const db = useSQLiteContext();
  const [days, setDays] = useState<PlannedDay[]>([]);
  const [template, setTemplate] = useState<WeekTemplate>(DEFAULT_TEMPLATE);

  const load = useCallback(async () => {
    const r = await loadDays(db, from, to);
    setTemplate(r.template);
    setDays(r.days);
  }, [db, from, to]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { days, template, reload: load };
}

export function useWeek(anyDateInWeek: ISODate) {
  const monday = weekStart(anyDateInWeek);
  const { days, reload } = useDays(monday, addDays(monday, 6));
  return { monday, days, reload };
}
