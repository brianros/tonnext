'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type NotationType = 'abc' | 'solfège';

interface NotationContextType {
  notationType: NotationType;
  setNotationType: (type: NotationType) => void;
  getNoteName: (tone: number) => string;
}

const NotationContext = createContext<NotationContextType | undefined>(undefined);

// Note name mappings
const ABC_NOTATION = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SOLFEGE_NOTATION = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

export function NotationProvider({ children }: { children: React.ReactNode }) {
  const [notationType, setNotationTypeState] = useState<NotationType>('abc');

  // Load notation preference from localStorage on mount
  useEffect(() => {
    const savedNotation = localStorage.getItem('tonnext-notation') as NotationType;
    if (savedNotation && (savedNotation === 'abc' || savedNotation === 'solfège')) {
      setNotationTypeState(savedNotation);
    }
  }, []);

  const setNotationType = (type: NotationType) => {
    setNotationTypeState(type);
    localStorage.setItem('tonnext-notation', type);
  };

  const getNoteName = (tone: number): string => {
    const noteNames = notationType === 'abc' ? ABC_NOTATION : SOLFEGE_NOTATION;
    return noteNames[tone % 12];
  };

  return (
    <NotationContext.Provider value={{ notationType, setNotationType, getNoteName }}>
      {children}
    </NotationContext.Provider>
  );
}

export function useNotation() {
  const context = useContext(NotationContext);
  if (context === undefined) {
    throw new Error('useNotation must be used within a NotationProvider');
  }
  return context;
} 