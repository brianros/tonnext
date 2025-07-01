'use client';

import React, { useRef, useCallback } from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { useMidiPlayer, MidiNote, MidiChord } from '@/hooks/useMidiPlayer';
import { useMidiContext } from '@/contexts/MidiContext';

interface MidiPlayerProps {
  onNoteStart?: (note: MidiNote) => void;
  onNoteEnd?: (note: MidiNote) => void;
  onChordStart?: (chord: MidiChord) => void;
  onChordEnd?: (chord: MidiChord) => void;
}

export default function MidiPlayer({ 
  onNoteStart, 
  onNoteEnd, 
  onChordStart, 
  onChordEnd
}: MidiPlayerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getCanvasCallbacks } = useMidiContext();
  
  const {
    isPlaying,
    currentTime,
    duration,
    midiData,
    fileName,
    parseMidiFile,
    startPlayback,
    stopPlayback,
    pausePlayback,
    seekTo,
    setNoteCallbacks
  } = useMidiPlayer();

  // Set up callbacks for canvas integration
  const setupCallbacks = useCallback(() => {
    const canvasCallbacks = getCanvasCallbacks();
    
    // If canvas callbacks aren't available yet, retry after a short delay
    if (!canvasCallbacks) {
      setTimeout(setupCallbacks, 100);
      return;
    }
    
    setNoteCallbacks({
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
  }, [setNoteCallbacks, onNoteStart, onNoteEnd, onChordStart, onChordEnd, getCanvasCallbacks]);

  // Set up callbacks when component mounts or callbacks change
  React.useEffect(() => {
    setupCallbacks();
  }, [setupCallbacks]);

  // Also retry setup when midiData changes (in case canvas wasn't ready when component first mounted)
  React.useEffect(() => {
    if (midiData) {
      setupCallbacks();
    }
  }, [midiData, setupCallbacks]);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'audio/midi' || file.name.endsWith('.mid'))) {
      stopPlayback();
      await parseMidiFile(file);
    }
  }, [parseMidiFile, stopPlayback]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const handleSeek = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(event.target.value);
    seekTo(newTime);
  }, [seekTo]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }, [isPlaying, startPlayback, pausePlayback]);

  return (
    <div className="midi-player" style={{
      background: 'var(--color-main)',
      color: '#fff',
      padding: '1rem',
      borderRadius: '8px',
      margin: '1rem 0'
    }}>
      {/* File Upload */}
      <div style={{ marginBottom: '1rem' }}>
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
          style={{ marginRight: '0.5rem' }}
        >
          Upload MIDI
        </button>
        {fileName && (
          <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>
            {fileName}
          </span>
        )}
      </div>

      {/* Playback Controls */}
      {midiData && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <button
              onClick={handlePlayPause}
              className="blend-btn"
              style={{ minWidth: '60px' }}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              onClick={stopPlayback}
              className="blend-btn"
              style={{ minWidth: '60px' }}
            >
              <Square size={16} />
            </button>
            <span style={{ fontSize: '0.9rem' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div style={{ width: '100%', marginBottom: '0.5rem' }}>
            <input
              type="range"
              min={0}
              max={duration}
              value={currentTime}
              onChange={handleSeek}
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '3px',
                background: 'var(--color-highlight)',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* MIDI Info */}
          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
            <div>Tempo: {midiData.tempo} BPM</div>
            <div>Time Signature: {midiData.timeSignature[0]}/{midiData.timeSignature[1]}</div>
            <div>Tracks: {midiData.tracks.length}</div>
            <div>Duration: {formatTime(midiData.duration)}</div>
          </div>
        </div>
      )}
    </div>
  );
} 