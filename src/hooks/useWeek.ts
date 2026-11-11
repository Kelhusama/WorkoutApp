import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { getLogsBetween, getSecondGym, setSecondGym, type SessionLog } from '@/db/repo';
import { addDays, today as getToday, weekStart, type ISODate } from '@/domain/dates';
import { dayStatus, weekPlan, type DayStatus, type DayType, type SecondGymDay } from '@/domain/schedule';

export interface PlannedDay {
  date: ISODate;
  type: DayType;
  status: DayStatus;
  log?: SessionLog;
}

export function useWeek(anyDateInWeek: ISODate) {
  const db = useSQLiteContext();
  const monday = weekStart(anyDateInWeek);
  const [secondGym, setSecond] = useState<SecondGymDay>('J');
  const [days, setDays] = useState<PlannedDay[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const second = await getSecondGym(db, monday);
    const logs = await getLogsBetween(db, monday, addDays(monday, 6));
    const todayDate = getToday();
    const plan = weekPlan(monday, second).map(({ date, type }) => {
      const kind = type === 'rest' ? null : type;
      const log = logs.find((l) => l.date === date && l.kind === kind);
      return { date, type, log, status: dayStatus(type, date, todayDate, log?.status) };
    });
    setSecond(second);
    setDays(plan);
    setLoaded(true);
  }, [db, monday]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const changeSecondGym = useCallback(
    async (day: SecondGymDay) => {
      await setSecondGym(db, monday, day);
      await load();
    },
    [db, monday, load],
  );

  return { monday, secondGym, days, loaded, reload: load, changeSecondGym };
}
