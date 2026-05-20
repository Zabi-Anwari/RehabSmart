/**
 * Live subscription to a patient's sessions for one rehab module.
 *
 * Returns sessions sorted newest-first. `loading` is true only until the
 * first snapshot arrives — subsequent updates keep loading=false so the UI
 * doesn't blink between writes.
 */

import { useEffect, useState } from 'react';
import { subscribeToSessions, type SessionRecord } from '../lib/sessions';
import type { RehabType } from '../types';

export interface UseSessionsResult {
  sessions: SessionRecord[];
  loading: boolean;
  error: string | null;
}

export function useSessions(uid: string | null | undefined, rehabType: RehabType): UseSessionsResult {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToSessions(
      uid,
      rehabType,
      (list) => {
        setSessions(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [uid, rehabType]);

  return { sessions, loading, error };
}
