/**
 * Doctor profile + public directory writes.
 *
 * A doctor's CV lives in two places:
 *   - users/{uid}.doctorProfile      (private fields like licenseNumber)
 *   - doctorDirectory/{uid}          (public mirror — what patients search)
 *
 * Mirroring keeps the patient-facing search query simple and avoids loosening
 * read access on the users collection.
 */

import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  DoctorProfile,
  DoctorDirectoryEntry,
  RehabType,
} from '../types';

export interface DoctorProfileInput {
  specialties: RehabType[];
  workArea: string;
  clinicName?: string;
  bio: string;
  yearsOfExperience: number;
  education: string[];
  certifications: string[];
  languages: string[];
  licenseNumber?: string;
}

/** A profile is "complete" (and surfaceable to patients) when these are set. */
export function isProfileComplete(p: DoctorProfileInput): boolean {
  return (
    p.specialties.length > 0 &&
    p.workArea.trim().length > 0 &&
    p.bio.trim().length >= 20 &&
    p.yearsOfExperience >= 0
  );
}

/**
 * Persist the doctor's CV. Writes to both the private profile field on
 * users/{uid} and the public directory entry. When the profile is incomplete,
 * the directory entry is removed so the doctor stops appearing in search.
 */
export async function saveDoctorProfile(
  uid: string,
  name: string,
  photoUrl: string | undefined,
  input: DoctorProfileInput,
): Promise<void> {
  const complete = isProfileComplete(input);

  await updateDoc(doc(db, 'users', uid), {
    doctorProfile: {
      ...input,
      profileComplete: complete,
      updatedAt: serverTimestamp(),
    },
  });

  if (complete) {
    const entry: Omit<DoctorDirectoryEntry, 'uid'> & { updatedAt: unknown } = {
      name,
      photoUrl: photoUrl ?? undefined,
      specialties: input.specialties,
      workArea: input.workArea,
      clinicName: input.clinicName,
      bio: input.bio,
      yearsOfExperience: input.yearsOfExperience,
      education: input.education,
      certifications: input.certifications,
      languages: input.languages,
      updatedAt: serverTimestamp(),
    };
    // Strip undefined values — Firestore rejects them.
    Object.keys(entry).forEach((k) => {
      if ((entry as Record<string, unknown>)[k] === undefined) {
        delete (entry as Record<string, unknown>)[k];
      }
    });
    await setDoc(doc(db, 'doctorDirectory', uid), entry);
  } else {
    // Best-effort: remove a stale entry if the doctor uncompleted their profile.
    try {
      await deleteDoc(doc(db, 'doctorDirectory', uid));
    } catch {
      // Was never in the directory in the first place. Fine.
    }
  }
}

/**
 * Live subscription to the doctor directory, optionally filtered by specialty.
 * Returns all doctors with a complete profile; UI filters by name client-side.
 */
export function subscribeToDoctors(
  onChange: (doctors: DoctorDirectoryEntry[]) => void,
  options: { specialty?: RehabType } = {},
  onError?: (err: Error) => void,
): Unsubscribe {
  const colRef = collection(db, 'doctorDirectory');
  const q = options.specialty
    ? query(colRef, where('specialties', 'array-contains', options.specialty))
    : query(colRef);
  return onSnapshot(
    q,
    (snap) => {
      const list: DoctorDirectoryEntry[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          uid: d.id,
          name: data.name,
          photoUrl: data.photoUrl,
          specialties: data.specialties ?? [],
          workArea: data.workArea ?? '',
          clinicName: data.clinicName,
          bio: data.bio ?? '',
          yearsOfExperience: data.yearsOfExperience ?? 0,
          education: data.education ?? [],
          certifications: data.certifications ?? [],
          languages: data.languages ?? [],
        });
      });
      onChange(list);
    },
    (err) => onError?.(err),
  );
}

/** One-shot subscribe-then-unsubscribe wrapper for a single doctor's directory entry. */
export function subscribeToDoctor(
  doctorUid: string,
  onChange: (doctor: DoctorDirectoryEntry | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'doctorDirectory', doctorUid),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      const data = snap.data();
      onChange({
        uid: snap.id,
        name: data.name,
        photoUrl: data.photoUrl,
        specialties: data.specialties ?? [],
        workArea: data.workArea ?? '',
        clinicName: data.clinicName,
        bio: data.bio ?? '',
        yearsOfExperience: data.yearsOfExperience ?? 0,
        education: data.education ?? [],
        certifications: data.certifications ?? [],
        languages: data.languages ?? [],
      });
    },
    (err) => onError?.(err),
  );
}

/**
 * Convert a Firestore-loaded doctorProfile (with Timestamp) into our
 * front-end DoctorProfile shape. Used by DoctorSettings to prefill the form.
 */
export function hydrateDoctorProfile(raw: Record<string, unknown> | undefined): DoctorProfile | null {
  if (!raw) return null;
  const ts = raw.updatedAt as Timestamp | undefined;
  return {
    specialties: (raw.specialties as RehabType[]) ?? [],
    workArea: (raw.workArea as string) ?? '',
    clinicName: raw.clinicName as string | undefined,
    bio: (raw.bio as string) ?? '',
    yearsOfExperience: (raw.yearsOfExperience as number) ?? 0,
    education: (raw.education as string[]) ?? [],
    certifications: (raw.certifications as string[]) ?? [],
    languages: (raw.languages as string[]) ?? [],
    licenseNumber: raw.licenseNumber as string | undefined,
    profileComplete: (raw.profileComplete as boolean) ?? false,
    updatedAt: ts?.toDate() ?? new Date(0),
  };
}
