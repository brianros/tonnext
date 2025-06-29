'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import type { MidiData, MidiNote, MidiChord } from '@/hooks/useMidiPlayer';
import { useMidiContext } from '@/contexts/MidiContext';

interface MidiPlayerCompactProps {
  onNoteStart?: (note: MidiNote) => void;
  onNoteEnd?: (note: MidiNote) => void;
  onChordStart?: (chord: MidiChord) => void;
  onChordEnd?: (chord: MidiChord) => void;
}

export default function MidiPlayerCompact({ 
  onNoteStart, 
  onNoteEnd, 
  onChordStart, 
  onChordEnd
}: MidiPlayerCompactProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getCanvasCallbacks, getMidiPlayerState, getMidiPlayerFunctions } = useMidiContext();
  
  // Track if test MIDI has been loaded
  const [testMidiLoaded, setTestMidiLoaded] = useState(false);
  
  // Get shared state from context
  const [playerState, setPlayerState] = useState<{
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    midiData: MidiData | null;
    fileName: string;
  } | null>(null);

  // Get shared functions from context
  const [playerFunctions, setPlayerFunctions] = useState<{
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
  } | null>(null);

  // Update local state when context state changes
  useEffect(() => {
    const updateState = () => {
      const state = getMidiPlayerState();
      if (state) {
        setPlayerState(state);
      }
    };

    // Update immediately
    updateState();

    // Set up polling to get updates - more frequent for smoother progress bar
    const interval = setInterval(updateState, 50); // 20fps instead of 10fps
    return () => clearInterval(interval);
  }, [getMidiPlayerState]);

  // Update local functions when context functions change
  useEffect(() => {
    const updateFunctions = () => {
      const functions = getMidiPlayerFunctions();
      if (functions) {
        setPlayerFunctions(functions);
      }
    };

    // Update immediately
    updateFunctions();

    // Set up polling to get function updates
    const interval = setInterval(updateFunctions, 100);
    return () => clearInterval(interval);
  }, [getMidiPlayerFunctions]);

  // Set up callbacks for canvas integration
  const setupCallbacks = useCallback(() => {
    if (!playerFunctions) return;
    
    const canvasCallbacks = getCanvasCallbacks();
    
    // If canvas callbacks aren't available yet, retry after a short delay
    if (!canvasCallbacks) {
      setTimeout(setupCallbacks, 100);
      return;
    }
    
    playerFunctions.setNoteCallbacks({
      onNoteStart: (note: MidiNote) => {
        onNoteStart?.(note);
        canvasCallbacks?.handleMidiNoteStart({ note: note.note, midi: note.midi, velocity: note.velocity });
      },
      onNoteEnd: (note: MidiNote) => {
        onNoteEnd?.(note);
        canvasCallbacks?.handleMidiNoteEnd({ note: note.note, midi: note.midi });
      },
      onChordStart: (chord: MidiChord) => {
        onChordStart?.(chord);
        canvasCallbacks?.handleMidiChordStart({ notes: chord.notes });
      },
      onChordEnd: (chord: MidiChord) => {
        onChordEnd?.(chord);
        canvasCallbacks?.handleMidiChordEnd();
      }
    });
  }, [playerFunctions, onNoteStart, onNoteEnd, onChordStart, onChordEnd, getCanvasCallbacks]);

  // Set up callbacks when component mounts or functions change
  React.useEffect(() => {
    setupCallbacks();
  }, [setupCallbacks]);

  // Also retry setup when midiData changes (in case canvas wasn't ready when component first mounted)
  React.useEffect(() => {
    if (playerState?.midiData && playerFunctions) {
      setupCallbacks();
    }
  }, [playerState?.midiData, playerFunctions, setupCallbacks]);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'audio/midi' || file.name.endsWith('.mid')) && playerFunctions) {
      await playerFunctions.parseMidiFile(file);
    }
  }, [playerFunctions]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleLoadBeethoven = useCallback(async () => {
    if (playerFunctions) {
      await playerFunctions.loadMidiFromUrl('/Beethoven-Moonlight-Sonata.mid', 'Beethoven - Moonlight Sonata');
      setTestMidiLoaded(true);
    }
  }, [playerFunctions]);

  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const handleSeek = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(event.target.value);
    if (playerFunctions) {
      playerFunctions.seekTo(newTime);
    }
  }, [playerFunctions]);

  const handlePlayPause = useCallback(() => {
    if (!playerFunctions) return;
    
    if (playerState?.isPlaying) {
      playerFunctions.pausePlayback();
    } else {
      playerFunctions.startPlayback();
    }
  }, [playerState?.isPlaying, playerFunctions]);

  const handleStop = useCallback(() => {
    if (playerFunctions) {
      playerFunctions.stopPlayback();
    }
  }, [playerFunctions]);

  return (
    <div className="midi-player-compact" style={{
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      fontSize: '0.9rem',
      flexWrap: 'nowrap',
      whiteSpace: 'nowrap',
      overflow: 'hidden'
    }}>
      {/* File Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mid,audio/midi"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <button
        onClick={handleUploadClick}
        className="blend-btn"
        style={{ fontSize: '2rem', padding: '0.5em 1.5em', borderTopRightRadius: 0, borderBottomRightRadius: 0, flexShrink: 0 }}
      >
        Load MIDI
      </button>
      {!testMidiLoaded && (
        <button
          onClick={handleLoadBeethoven}
          className="blend-btn"
          style={{ fontSize: '2rem', padding: '0.5em 1.5em', borderRadius: 0, flexShrink: 0 }}
        >
          Test MIDI
        </button>
      )}

      {/* Playback Controls */}
      {playerState?.midiData && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 0, flexShrink: 0 }}>
          <button
            onClick={handlePlayPause}
            className="blend-btn midi-theme-btn"
            style={{
              fontSize: '1rem',
              padding: '0.3em 0.8em',
              borderRadius: 0,
              transition: 'background 0.2s, color 0.2s',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            {playerState.isPlaying ? '⏸️' : '▶️'}
          </button>
          <button
            onClick={handleStop}
            className="blend-btn midi-theme-btn"
            style={{
              fontSize: '1rem',
              padding: '0.3em 0.8em',
              borderRadius: 0,
              transition: 'background 0.2s, color 0.2s',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            ⏹️
          </button>
          {/* Progress Bar */}
          <div style={{ width: '120px', marginLeft: 8, flexShrink: 0 }}>
            <input
              type="range"
              min={0}
              max={playerState.duration || 0}
              value={playerState.currentTime || 0}
              onChange={handleSeek}
              step={0.1}
              style={{
                width: '100%',
                height: '4px',
                borderRadius: '2px',
                background: 'var(--color-highlight)',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
          </div>
          {/* Time Display */}
          <span style={{ fontSize: '0.8rem', opacity: 0.8, minWidth: '60px', marginLeft: 8, flexShrink: 0 }}>
            {formatTime(playerState.currentTime)} / {formatTime(playerState.duration)}
          </span>
          {/* File Name */}
          <span style={{ fontSize: '0.8rem', opacity: 0.7, maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 8, flexShrink: 0 }}>
            {playerState.fileName}
          </span>
        </div>
      )}
    </div>
  );
} 