'use client';

import React, { createContext, useContext, useRef } from 'react';
import type { MidiData, MidiNote, MidiChord } from '@/hooks/useMidiPlayer';
import type { Instrument } from '@/components/InstrumentSelector';

interface MidiContextType {
  setCanvasCallbacks: (callbacks: {
    handleMidiNoteStart: (note: { note: string; midi: number; velocity: number }) => void;
    handleMidiNoteEnd: (note: { note: string; midi: number }) => void;
    handleMidiChordStart: (chord: { notes: Array<{ midi: number }> }) => void;
    handleMidiChordEnd: () => void;
  }) => void;
  getCanvasCallbacks: () => {
    handleMidiNoteStart: (note: { note: string; midi: number; velocity: number }) => void;
    handleMidiNoteEnd: (note: { note: string; midi: number }) => void;
    handleMidiChordStart: (chord: { notes: Array<{ midi: number }> }) => void;
    handleMidiChordEnd: () => void;
  } | null;
  // MIDI Player state
  setMidiPlayerState: (state: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    midiData: MidiData | null;
    fileName: string;
  }) => void;
  getMidiPlayerState: () => {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    midiData: MidiData | null;
    fileName: string;
  } | null;
  // MIDI Player functions
  setMidiPlayerFunctions: (functions: {
    parseMidiFile: (file: File) => Promise<MidiData | null>;
    loadMidiFromUrl: (url: string, fileName: string) => Promise<MidiData | null>;
    startPlayback: () => Promise<void>;
    stopPlayback: () => void;
    pausePlayback: () => void;
    seekTo: (time: number) => void;
    setNoteCallbacks: (callbacks: {
      onNoteStart?: (note: MidiNote) => void;
      onNoteEnd?: (note: MidiNote) => void;
      onChordStart?: (chord: MidiChord) => void;
      onChordEnd?: (chord: MidiChord) => void;
    }) => void;
    updateInstrument: (instrument: Instrument) => Promise<void>;
  }) => void;
  getMidiPlayerFunctions: () => {
    parseMidiFile: (file: File) => Promise<MidiData | null>;
    loadMidiFromUrl: (url: string, fileName: string) => Promise<MidiData | null>;
    startPlayback: () => Promise<void>;
    stopPlayback: () => void;
    pausePlayback: () => void;
    seekTo: (time: number) => void;
    setNoteCallbacks: (callbacks: {
      onNoteStart?: (note: MidiNote) => void;
      onNoteEnd?: (note: MidiNote) => void;
      onChordStart?: (chord: MidiChord) => void;
      onChordEnd?: (chord: MidiChord) => void;
    }) => void;
    updateInstrument: (instrument: Instrument) => Promise<void>;
  } | null;
  // Instrument state
  setSelectedInstrument: (instrument: Instrument) => void;
  getSelectedInstrument: () => Instrument | null;
}

const MidiContext = createContext<MidiContextType | null>(null);

export function MidiProvider({ children }: { children: React.ReactNode }) {
  const canvasCallbacksRef = useRef<{
    handleMidiNoteStart: (note: { note: string; midi: number; velocity: number }) => void;
    handleMidiNoteEnd: (note: { note: string; midi: number }) => void;
    handleMidiChordStart: (chord: { notes: Array<{ midi: number }> }) => void;
    handleMidiChordEnd: () => void;
  } | null>(null);

  const midiPlayerStateRef = useRef<{
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    midiData: MidiData | null;
    fileName: string;
  } | null>(null);

  const midiPlayerFunctionsRef = useRef<{
    parseMidiFile: (file: File) => Promise<MidiData | null>;
    loadMidiFromUrl: (url: string, fileName: string) => Promise<MidiData | null>;
    startPlayback: () => Promise<void>;
    stopPlayback: () => void;
    pausePlayback: () => void;
    seekTo: (time: number) => void;
    setNoteCallbacks: (callbacks: {
      onNoteStart?: (note: MidiNote) => void;
      onNoteEnd?: (note: MidiNote) => void;
      onChordStart?: (chord: MidiChord) => void;
      onChordEnd?: (chord: MidiChord) => void;
    }) => void;
    updateInstrument: (instrument: Instrument) => Promise<void>;
  } | null>(null);

  const selectedInstrumentRef = useRef<Instrument | null>(null);

  const setCanvasCallbacks = (callbacks: typeof canvasCallbacksRef.current) => {
    canvasCallbacksRef.current = callbacks;
  };

  const getCanvasCallbacks = () => {
    return canvasCallbacksRef.current;
  };

  const setMidiPlayerState = (state: typeof midiPlayerStateRef.current) => {
    midiPlayerStateRef.current = state;
  };

  const getMidiPlayerState = () => {
    return midiPlayerStateRef.current;
  };

  const setMidiPlayerFunctions = (functions: typeof midiPlayerFunctionsRef.current) => {
    midiPlayerFunctionsRef.current = functions;
  };

  const getMidiPlayerFunctions = () => {
    return midiPlayerFunctionsRef.current;
  };

  const setSelectedInstrument = (instrument: Instrument) => {
    selectedInstrumentRef.current = instrument;
  };

  const getSelectedInstrument = () => {
    return selectedInstrumentRef.current;
  };

  return (
    <MidiContext.Provider value={{ 
      setCanvasCallbacks, 
      getCanvasCallbacks,
      setMidiPlayerState,
      getMidiPlayerState,
      setMidiPlayerFunctions,
      getMidiPlayerFunctions,
      setSelectedInstrument,
      getSelectedInstrument
    }}>
      {children}
    </MidiContext.Provider>
  );
}

export function useMidiContext() {
  const context = useContext(MidiContext);
  if (!context) {
    throw new Error('useMidiContext must be used within a MidiProvider');
  }
  return context;
} 