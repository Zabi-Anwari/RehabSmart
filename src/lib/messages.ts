/**
 * Chat message writes/subscriptions for a connection thread.
 *
 *   connections/{connectionId}/messages/{messageId}
 *
 * Each send also updates the parent connection doc with denormalized
 * lastMessage* fields and increments the recipient's unread counter so the
 * Messages list and top-bar badge can render without scanning the subcollection.
 */

import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Message } from '../types';

export interface SendMessageInput {
  connectionId: string;
  senderUid: string;
  senderRole: 'patient' | 'doctor';
  text: string;
}

/** Send a message + bump unread counter on the recipient side. */
export async function sendMessage(input: SendMessageInput): Promise<void> {
  const trimmed = input.text.trim();
  if (!trimmed) return;
  if (trimmed.length > 2000) {
    throw new Error('Message too long (max 2000 characters).');
  }

  // 1. Write the message into the subcollection.
  await addDoc(collection(db, 'connections', input.connectionId, 'messages'), {
    senderUid:  input.senderUid,
    senderRole: input.senderRole,
    text:       trimmed,
    sentAt:     serverTimestamp(),
  });

  // 2. Update denormalized metadata on the connection doc so the Messages list
  //    can sort + show the preview without reading the subcollection.
  const recipientUnreadField = input.senderRole === 'patient' ? 'doctorUnread' : 'patientUnread';
  await updateDoc(doc(db, 'connections', input.connectionId), {
    lastMessageAt:   serverTimestamp(),
    lastMessageText: trimmed.length > 120 ? trimmed.slice(0, 120) + '…' : trimmed,
    lastMessageBy:   input.senderRole,
    [recipientUnreadField]: increment(1),
  });
}

/**
 * Reset the unread counter for the side that just opened the thread. Pass
 * the role of the *viewer* — their counter is the one we clear.
 */
export async function markThreadRead(
  connectionId: string,
  viewerRole: 'patient' | 'doctor',
): Promise<void> {
  const field = viewerRole === 'patient' ? 'patientUnread' : 'doctorUnread';
  try {
    await updateDoc(doc(db, 'connections', connectionId), { [field]: 0 });
  } catch {
    // Connection may not exist yet (race on open) — safe to ignore.
  }
}

/** Real-time subscription to a connection's chat thread, oldest → newest. */
export function subscribeToThread(
  connectionId: string,
  onChange: (msgs: Message[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'connections', connectionId, 'messages'),
    orderBy('sentAt', 'asc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const msgs: Message[] = [];
      snap.forEach((d) => {
        const data = d.data();
        const ts = data.sentAt as Timestamp | null;
        if (!ts) return; // server timestamp not yet resolved
        msgs.push({
          id:         d.id,
          senderUid:  data.senderUid,
          senderRole: data.senderRole,
          text:       data.text,
          sentAt:     ts.toDate(),
        });
      });
      onChange(msgs);
    },
    (err) => onError?.(err),
  );
}
