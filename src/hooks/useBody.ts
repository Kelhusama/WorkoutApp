import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { getBodyLog, getProfile } from '@/db/body';
import type { BodyEntry, Profile } from '@/domain/body';

export function useBody() {
  const db = useSQLiteContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<BodyEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setProfile(await getProfile(db));
        setEntries(await getBodyLog(db));
        setLoaded(true);
      })();
    }, [db]),
  );

  return { profile, entries, loaded, last: entries[entries.length - 1] ?? null };
}
