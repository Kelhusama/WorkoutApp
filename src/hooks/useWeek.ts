import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { loadDays, setSecondGym, type PlannedDay } from '@/db/repo';
import { addDays, weekStart, type ISODate } from '@/domain/dates';
import { DEFAULT_SECOND_GYM, type SecondGymDay } from '@/domain/schedule';
import { syncReminders } from '@/notifications/reminders';

export type { PlannedDay };

/** Días planificados con su estado entre dos fechas (incluidas). */
export function useDays(from: ISODate, to: ISODate) {
  const db = useSQLiteContext();
  const [days, setDays] = useState<PlannedDay[]>([]);
  const [configs, setConfigs] = useState<Map<ISODate, SecondGymDay>>(new Map());

  const load = useCallback(async () => {
    const { days: out, configs: cfg } = await loadDays(db, from, to);
    setConfigs(cfg);
    setDays(out);
  }, [db, from, to]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const changeSecondGym = useCallback(
    async (anyDate: ISODate, day: SecondGymDay) => {
      await setSecondGym(db, anyDate, day);
      await load();
      syncReminders(db);
    },
    [db, load],
  );

  const secondGymOf = (anyDate: ISODate) => configs.get(weekStart(anyDate)) ?? DEFAULT_SECOND_GYM;

  return { days, reload: load, changeSecondGym, secondGymOf };
}

export function useWeek(anyDateInWeek: ISODate) {
  const monday = weekStart(anyDateInWeek);
  const { days, reload, changeSecondGym, secondGymOf } = useDays(monday, addDays(monday, 6));
  return {
    monday,
    days,
    reload,
    secondGym: secondGymOf(monday),
    changeSecondGym: (day: SecondGymDay) => changeSecondGym(monday, day),
  };
}
