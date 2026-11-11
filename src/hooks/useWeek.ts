import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { getLogsBetween, getWeekConfigs, setSecondGym, type SessionLog } from '@/db/repo';
import { addDays, today as getToday, weekStart, type ISODate } from '@/domain/dates';
import {
  DEFAULT_SECOND_GYM,
  dayStatus,
  dayTypeFor,
  type DayStatus,
  type DayType,
  type SecondGymDay,
} from '@/domain/schedule';

export interface PlannedDay {
  date: ISODate;
  type: DayType;
  status: DayStatus;
  log?: SessionLog;
}

/** Días planificados con su estado entre dos fechas (incluidas). */
export function useDays(from: ISODate, to: ISODate) {
  const db = useSQLiteContext();
  const [days, setDays] = useState<PlannedDay[]>([]);
  const [configs, setConfigs] = useState<Map<ISODate, SecondGymDay>>(new Map());

  const load = useCallback(async () => {
    const cfg = await getWeekConfigs(db, from, to);
    const logs = await getLogsBetween(db, from, to);
    const todayDate = getToday();
    const out: PlannedDay[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const type = dayTypeFor(d, cfg.get(weekStart(d)) ?? DEFAULT_SECOND_GYM);
      const log = type === 'rest' ? undefined : logs.find((l) => l.date === d && l.kind === type);
      out.push({ date: d, type, log, status: dayStatus(type, d, todayDate, log?.status) });
    }
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
