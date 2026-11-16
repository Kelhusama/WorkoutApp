import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { loadMarch, type MarchSnapshot } from '@/db/march';
import { getTemplate } from '@/db/repo';
import { today, weekdayIndex } from '@/domain/dates';
import { plannedWalks, type PlannedWalk } from '@/domain/march';
import { stepAt, walkDays, type WalkDays } from '@/domain/marchPlan';

export interface MarchView extends MarchSnapshot {
  /** Caminatas del escalón actual, con las ya hechas. Vacío si no hay plan. */
  planned: PlannedWalk[];
  /** Día de la semana sugerido para cada caminata. */
  days: WalkDays | null;
  /** Caminata del plan que toca hoy y aún no está hecha. */
  dueToday: PlannedWalk | null;
}

const DAY_OF: Record<PlannedWalk['kind'], keyof WalkDays> = { suave: 'easy', cuestas: 'hills', extra: 'extra', larga: 'long' };

/** Plan de marcha al día. Se recalcula cada vez que se vuelve a la pantalla. */
export function useMarch() {
  const db = useSQLiteContext();
  const [view, setView] = useState<MarchView | null>(null);

  const reload = useCallback(async () => {
    const now = today();
    const snap = await loadMarch(db, now);
    if (!snap.state || snap.state.completed) {
      setView({ ...snap, planned: [], days: null, dueToday: null });
      return snap;
    }
    const since = snap.state.since;
    const planned = plannedWalks(
      stepAt(snap.state.step),
      snap.walks.filter((w) => w.date >= since),
    );
    const days = walkDays(await getTemplate(db));
    const dueToday = planned.find((p) => !p.done && days[DAY_OF[p.kind]] === weekdayIndex(now)) ?? null;
    setView({ ...snap, planned, days, dueToday });
    return snap;
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { view, reload, dayOf: (kind: PlannedWalk['kind']) => (view?.days ? view.days[DAY_OF[kind]] : null) };
}
