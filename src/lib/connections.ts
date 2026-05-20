/**
 * Patient ↔ doctor connection writes/subscriptions.
 *
 * Each connection lives at `connections/{patientUid}_{doctorUid}` so the
 * deterministic ID prevents a patient from accidentally requesting the same
 * doctor twice. Messages live in a subcollection at
 * `connections/{id}/messages` — see lib/messages.ts.
 */

import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Connection,
  ConnectionStatus,
  InjuryType,
  RehabType,
} from '../types';

export function connectionId(patientUid: string, doctorUid: string): string {
  return `${patientUid}_${doctorUid}`;
}

export interface RequestConnectionInput {
  patientUid: string;
  doctorUid: string;
  patientName: string;
  patientPhotoUrl?: string;
  patientInjuryType?: InjuryType;
  doctorName: string;
  doctorPhotoUrl?: string;
  doctorSpecialties: RehabType[];
  introMessage?: string;
}

/**
 * Patient sends a connection request to a doctor. Idempotent: if a doc with
 * the same deterministic ID already exists, this throws so the UI can show a
 * "you've already requested this doctor" message.
 */
export async function requestConnection(input: RequestConnectionInput): Promise<string> {
  const id = connectionId(input.patientUid, input.doctorUid);
  const ref = doc(db, 'connections', id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const status = existing.data().status as ConnectionStatus;
    throw new Error(
      status === 'accepted' ? 'already-connected' :
      status === 'pending'  ? 'already-pending' :
      status === 'declined' ? 'previously-declined' :
      'connection-exists',
    );
  }

  const payload: Record<string, unknown> = {
    patientUid: input.patientUid,
    doctorUid: input.doctorUid,
    patientName: input.patientName,
    doctorName: input.doctorName,
    doctorSpecialties: input.doctorSpecialties,
    status: 'pending',
    requestedAt: serverTimestamp(),
    patientUnread: 0,
    doctorUnread: 0,
  };
  if (input.patientPhotoUrl)    payload.patientPhotoUrl    = input.patientPhotoUrl;
  if (input.doctorPhotoUrl)     payload.doctorPhotoUrl     = input.doctorPhotoUrl;
  if (input.patientInjuryType)  payload.patientInjuryType  = input.patientInjuryType;
  if (input.introMessage)       payload.introMessage       = input.introMessage;

  await setDoc(ref, payload);
  return id;
}

/** Doctor accepts a pending request. */
export async function acceptConnection(id: string): Promise<void> {
  await updateDoc(doc(db, 'connections', id), {
    status: 'accepted',
    respondedAt: serverTimestamp(),
  });
}

/** Doctor declines a pending request. The doc is kept so the patient can see the response. */
export async function declineConnection(id: string): Promise<void> {
  await updateDoc(doc(db, 'connections', id), {
    status: 'declined',
    respondedAt: serverTimestamp(),
  });
}

/** Get a single connection's current state (one-shot read). */
export async function getConnection(id: string): Promise<Connection | null> {
  const snap = await getDoc(doc(db, 'connections', id));
  if (!snap.exists()) return null;
  return hydrateConnection(snap.id, snap.data());
}

/** Convert a Firestore connection doc into the typed shape. */
function hydrateConnection(id: string, data: Record<string, unknown>): Connection {
  const requestedAt    = data.requestedAt    as Timestamp | null;
  const respondedAt    = data.respondedAt    as Timestamp | null;
  const lastMessageAt  = data.lastMessageAt  as Timestamp | null;
  return {
    id,
    patientUid:        data.patientUid as string,
    doctorUid:         data.doctorUid  as string,
    patientName:       (data.patientName as string) ?? '',
    patientPhotoUrl:   data.patientPhotoUrl as string | undefined,
    patientInjuryType: data.patientInjuryType as InjuryType | undefined,
    doctorName:        (data.doctorName as string) ?? '',
    doctorPhotoUrl:    data.doctorPhotoUrl as string | undefined,
    doctorSpecialties: (data.doctorSpecialties as RehabType[]) ?? [],
    status:            (data.status as ConnectionStatus) ?? 'pending',
    requestedAt:       requestedAt?.toDate() ?? new Date(0),
    respondedAt:       respondedAt?.toDate(),
    introMessage:      data.introMessage as string | undefined,
    lastMessageAt:     lastMessageAt?.toDate(),
    lastMessageText:   data.lastMessageText as string | undefined,
    lastMessageBy:     data.lastMessageBy as 'patient' | 'doctor' | undefined,
    patientUnread:     (data.patientUnread as number) ?? 0,
    doctorUnread:      (data.doctorUnread as number) ?? 0,
  };
}

/** Subscribe to all connections involving this patient (any status). */
export function subscribeConnectionsForPatient(
  patientUid: string,
  onChange: (conns: Connection[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'connections'),
    where('patientUid', '==', patientUid),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: Connection[] = [];
      snap.forEach((d) => list.push(hydrateConnection(d.id, d.data())));
      // Sort by most recent activity (last message > request time) client-side
      // so we don't need a composite index just for this.
      list.sort((a, b) => {
        const ta = a.lastMessageAt?.getTime() ?? a.requestedAt.getTime();
        const tb = b.lastMessageAt?.getTime() ?? b.requestedAt.getTime();
        return tb - ta;
      });
      onChange(list);
    },
    (err) => onError?.(err),
  );
}

/** Subscribe to all connections involving this doctor (any status). */
export function subscribeConnectionsForDoctor(
  doctorUid: string,
  onChange: (conns: Connection[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'connections'),
    where('doctorUid', '==', doctorUid),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: Connection[] = [];
      snap.forEach((d) => list.push(hydrateConnection(d.id, d.data())));
      list.sort((a, b) => {
        const ta = a.lastMessageAt?.getTime() ?? a.requestedAt.getTime();
        const tb = b.lastMessageAt?.getTime() ?? b.requestedAt.getTime();
        return tb - ta;
      });
      onChange(list);
    },
    (err) => onError?.(err),
  );
}

/** Subscribe to a single connection (used by the chat thread + patient detail page). */
export function subscribeConnection(
  id: string,
  onChange: (conn: Connection | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'connections', id),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange(hydrateConnection(snap.id, snap.data()));
    },
    (err) => onError?.(err),
  );
}
