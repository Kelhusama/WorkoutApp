import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { loadFlex, type FlexSnapshot } from '@/db/flexibility';
import { today } from '@/domain/dates';
import { anyTestDue, weekAdherence, type WeekAdherence } from '@/domain/flexibility';

export interface FlexView extends FlexSnapshot {
  today: string;
  week: WeekAdherence;
  /** Hay al menos un test sin hacer o con más de 28 días. */
  testDue: boolean;
}

/** Programa de flexibilidad al día. Se recalcula cada vez que se vuelve a la pantalla. */
export function useFlex() {
  const db = useSQLiteContext();
  const [view, setView] = useState<FlexView | null>(null);

  const reload = useCallback(async () => {
    const now = today();
    const snap = await loadFlex(db, now);
    setView({
      ...snap,
      today: now,
      week: weekAdherence(snap.sessions.map((s) => s.date), now),
      testDue: anyTestDue(snap.tests, now),
    });
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { view, reload };
}
