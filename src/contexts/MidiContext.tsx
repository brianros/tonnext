'use client';

import React, { createContext, useContext, useRef } from 'react';
import { MidiNote, MidiChord } from '@/hooks/useMidiPlayer';

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
    midiData: any;
    fileName: string;
  }) => void;
  getMidiPlayerState: () => {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    midiData: any;
    fileName: string;
  } | null;
  // MIDI Player functions
  setMidiPlayerFunctions: (functions: {
    parseMidiFile: (file: File) => Promise<any>;
    loadMidiFromUrl: (url: string, fileName: string) => Promise<any>;
    startPlayback: () => Promise<void>;
    stopPlayback: () => void;
    pausePlayback: () => void;
    seekTo: (time: number) => void;
    setNoteCallbacks: (callbacks: any) => void;
  }) => void;
  getMidiPlayerFunctions: () => {
    parseMidiFile: (file: File) => Promise<any>;
    loadMidiFromUrl: (url: string, fileName: string) => Promise<any>;
    startPlayback: () => Promise<void>;
    stopPlayback: () => void;
    pausePlayback: () => void;
    seekTo: (time: number) => void;
    setNoteCallbacks: (callbacks: any) => void;
  } | null;
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
    midiData: any;
    fileName: string;
  } | null>(null);

  const midiPlayerFunctionsRef = useRef<{
    parseMidiFile: (file: File) => Promise<any>;
    loadMidiFromUrl: (url: string, fileName: string) => Promise<any>;
    startPlayback: () => Promise<void>;
    stopPlayback: () => void;
    pausePlayback: () => void;
    seekTo: (time: number) => void;
    setNoteCallbacks: (callbacks: any) => void;
  } | null>(null);

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

  return (
    <MidiContext.Provider value={{ 
      setCanvasCallbacks, 
      getCanvasCallbacks,
      setMidiPlayerState,
      getMidiPlayerState,
      setMidiPlayerFunctions,
      getMidiPlayerFunctions
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