/**
 * Firestore session writes/subscriptions.
 *
 * Schema (`users/{uid}/sessions/{auto-id}`):
 *   date           server Timestamp (set on write)
 *   rehabType      'knee' | 'leg' | 'elbow'
 *   exerciseId     string
 *   exerciseTitle  string
 *   duration       number   (seconds)
 *   quality        number   0–100  (form score from ML pipeline, 0 when offline)
 *   painLevel      number   0–10   (patient-reported, post-session)
 *   repCount       number   reps actually completed
 *   setsCompleted  number   sets actually completed
 *   romDegrees     number   max joint angle − min joint angle observed during the session
 */

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { RehabType } from '../types';

export interface SessionRecord {
  id: string;
  date: Date;                 // resolved from Firestore Timestamp
  rehabType: RehabType;
  exerciseId: string;
  exerciseTitle: string;
  duration: number;
  quality: number;
  painLevel: number;
  repCount: number;
  setsCompleted: number;
  romDegrees: number;
}

export interface SessionCreatePayload {
  rehabType: RehabType;
  exerciseId: string;
  exerciseTitle: string;
  duration: number;
  quality: number;
  painLevel: number;
  repCount: number;
  setsCompleted: number;
  romDegrees: number;
}

export async function createSession(uid: string, payload: SessionCreatePayload): Promise<void> {
  await addDoc(collection(db, 'users', uid, 'sessions'), {
    ...payload,
    // Field name kept as `date` to match the firestore.rules contract.
    date: serverTimestamp(),
  });
}

export function subscribeToSessions(
  uid: string,
  rehabType: RehabType,
  onChange: (sessions: SessionRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'users', uid, 'sessions'),
    where('rehabType', '==', rehabType),
    orderBy('date', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const sessions: SessionRecord[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        // `date` is a serverTimestamp; it can be null for a brief window right
        // after write before the server roundtrip resolves. Skip those — the
        // next snapshot will include the resolved value.
        const ts = data.date as Timestamp | null;
        if (!ts) return;
        sessions.push({
          id: doc.id,
          date: ts.toDate(),
          rehabType: data.rehabType,
          exerciseId: data.exerciseId,
          exerciseTitle: data.exerciseTitle,
          duration: data.duration,
          quality: data.quality,
          painLevel: data.painLevel,
          repCount: data.repCount,
          setsCompleted: data.setsCompleted,
          romDegrees: data.romDegrees,
        });
      });
      onChange(sessions);
    },
    (err) => onError?.(err),
  );
}
