import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import i18n from 'i18next';
import { auth, db } from '../lib/firebase';
import { InjuryType } from '../types';
import { isSupportedLanguage } from '../lib/i18n';

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'patient' | 'doctor';
  injuryType?: InjuryType;
  recoveryProgress: number;
  age?: number;
  photoUrl?: string;
  /** UI language preference. Synced to i18next when the profile loads. */
  language?: 'en' | 'ru' | 'kk';
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setProfile(data);
            // Apply the user's stored language preference to i18next if it
            // differs from the current setting — keeps the UI in their
            // language across devices. Defers to i18next's detector for
            // signed-out users.
            if (isSupportedLanguage(data.language) && i18n.language !== data.language) {
              void i18n.changeLanguage(data.language);
            }
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile snapshot error (check rules):", error);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const signOut = () => auth.signOut();

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
