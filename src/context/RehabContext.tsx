import React, { createContext, useContext, useState } from 'react';
import { RehabType } from '../types';

interface RehabContextType {
  rehabType: RehabType;
  setRehabType: (type: RehabType) => void;
}

const RehabContext = createContext<RehabContextType | undefined>(undefined);

const STORAGE_KEY = 'rehabsmart_rehab_type';
const DEFAULT_REHAB_TYPE: RehabType = 'knee';

function isValidRehabType(v: string | null): v is RehabType {
  return v === 'knee' || v === 'leg' || v === 'elbow';
}

export function RehabProvider({ children }: { children: React.ReactNode }) {
  const [rehabType, setRehabTypeState] = useState<RehabType>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isValidRehabType(stored) ? stored : DEFAULT_REHAB_TYPE;
  });

  const setRehabType = (type: RehabType) => {
    localStorage.setItem(STORAGE_KEY, type);
    setRehabTypeState(type);
  };

  return (
    <RehabContext.Provider value={{ rehabType, setRehabType }}>
      {children}
    </RehabContext.Provider>
  );
}

export function useRehab() {
  const context = useContext(RehabContext);
  if (!context) throw new Error('useRehab must be used within RehabProvider');
  return context;
}
