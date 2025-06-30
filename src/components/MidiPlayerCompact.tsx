'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import type { MidiData, MidiNote, MidiChord } from '@/hooks/useMidiPlayer';
import { useMidiContext } from '@/contexts/MidiContext';
import { createVirtualTonnetz } from './VirtualTonnetz';

interface MidiPlayerCompactProps {
  onNoteStart?: (note: MidiNote) => void;
  onNoteEnd?: (note: MidiNote) => void;
  onChordStart?: (chord: MidiChord) => void;
  onChordEnd?: (chord: MidiChord) => void;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  mode: 'note' | 'chord' | 'arpeggio';
  chordType: string;
}

export default function MidiPlayerCompact({ 
  onNoteStart, 
  onNoteEnd, 
  onChordStart, 
  onChordEnd,
  canvasRef,
  mode,
  chordType
}: MidiPlayerCompactProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getCanvasCallbacks, getMidiPlayerState, getMidiPlayerFunctions } = useMidiContext();
  
  // Get current density from the main canvas
  const [currentDensity, setCurrentDensity] = useState(20);
  
  // Global density tracker
  const getCurrentDensity = () => {
    return (window as any).__currentCanvasDensity || 20;
  };
  
  // Track if test MIDI has been loaded
  const [testMidiLoaded, setTestMidiLoaded] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
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
    const interval = setInterval(updateState, 100); // Reduced frequency to prevent excessive updates
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

    // Set up polling to get function updates - less frequent since functions don't change often
    const interval = setInterval(updateFunctions, 500);
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

  // Get current density from the main canvas
  React.useEffect(() => {
    const updateDensity = () => {
      const density = getCurrentDensity();
      setCurrentDensity(density);
    };

    // Update immediately
    updateDensity();

    // Set up polling to get density updates
    const interval = setInterval(updateDensity, 100);
    return () => clearInterval(interval);
  }, []);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'audio/midi' || file.name.endsWith('.mid')) && playerFunctions) {
      playerFunctions.stopPlayback();
      await playerFunctions.parseMidiFile(file);
    }
  }, [playerFunctions]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleLoadBeethoven = useCallback(async () => {
    if (playerFunctions) {
      playerFunctions.stopPlayback();
      await playerFunctions.loadMidiFromUrl('/example.mid', 'Example MIDI');
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

  // Export functionality
  const handleExportImage = useCallback(() => {
    if (!canvasRef?.current) {
      console.warn('Canvas reference not available for export');
      return;
    }

    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `visualization-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [canvasRef]);

  const handleExportVideo = useCallback(() => {
    if (!playerState?.midiData) {
      alert('No MIDI file loaded. Please load a MIDI file before recording.');
      return;
    }

    // Check if MediaRecorder is supported
    if (!window.MediaRecorder) {
      alert('Video recording is not supported in this browser');
      return;
    }

    try {
      // Create a virtual canvas for high-speed recording
      const virtualCanvas = document.createElement('canvas');
      // Match the real canvas size if available
      if (canvasRef?.current) {
        virtualCanvas.width = canvasRef.current.width;
        virtualCanvas.height = canvasRef.current.height;
      } else {
        virtualCanvas.width = 1920; // fallback
        virtualCanvas.height = 1080;
      }
      virtualCanvas.style.position = 'absolute';
      virtualCanvas.style.left = '-9999px';
      virtualCanvas.style.top = '-9999px';
      document.body.appendChild(virtualCanvas);

      const ctx = virtualCanvas.getContext('2d');
      if (!ctx) {
        alert('Cannot create virtual canvas context');
        return;
      }

      // Initialize virtual tonnetz system with the same options as the real canvas
      const virtualTonnetz = createVirtualTonnetz(virtualCanvas, ctx, { 
        mode, 
        chordType, 
        density: currentDensity 
      });
      
      // Calculate recording parameters
      const songDuration = playerState?.duration || 30;
      const speedMultiplier = 8; // 8x speed for faster recording
      const recordingDuration = songDuration / speedMultiplier;
      const frameRate = 60; // 60 FPS for smooth video
      
      console.log(`Recording at ${speedMultiplier}x speed: ${songDuration}s → ${recordingDuration}s`);

      // Start recording from virtual canvas
      const stream = virtualCanvas.captureStream(frameRate);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      const chunks: Blob[] = [];
      let recordingActive = true;
      setIsRecording(true);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `visualization-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
        }
        
        // Cleanup
        document.body.removeChild(virtualCanvas);
        setIsRecording(false);
      };

      // Start recording
      mediaRecorder.start();

      // Show recording indicator
      const exportBtn = document.getElementById('export-video-btn');
      if (exportBtn) {
        exportBtn.textContent = '⏹️ Recording...';
        exportBtn.setAttribute('disabled', 'true');
      }

      // Simulate MIDI playback at high speed
      const startTime = Date.now();
      const simulateMidiPlayback = () => {
        if (!recordingActive) return;

        const elapsed = (Date.now() - startTime) / 1000;
        const virtualTime = elapsed * speedMultiplier;
        
        if (virtualTime >= songDuration) {
          // Recording complete
          recordingActive = false;
          mediaRecorder.stop();
          if (exportBtn) {
            exportBtn.textContent = '🎬 Export Video';
            exportBtn.removeAttribute('disabled');
          }
          return;
        }

        // Check if density has changed and update virtual canvas
        const currentDensityValue = getCurrentDensity();
        if (currentDensityValue !== virtualTonnetz.getDensity()) {
          virtualTonnetz.updateDensity(currentDensityValue);
        }

        // Update virtual tonnetz with current MIDI state
        virtualTonnetz.update(virtualTime, playerState?.midiData);
        
        // Continue simulation
        requestAnimationFrame(simulateMidiPlayback);
      };

      // Start simulation
      simulateMidiPlayback();

    } catch (error) {
      console.error('Failed to start video recording:', error);
      alert('Failed to start video recording: ' + error);
    }
  }, [playerState?.midiData, playerState?.duration, mode, chordType, canvasRef]);

  return (
    <>
      {/* Recording Modal Overlay */}
      {isRecording && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '1.5rem',
          fontWeight: 'bold'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎬</div>
            <div>Recording Video...</div>
            <div style={{ fontSize: '1rem', marginTop: '0.5rem', opacity: 0.8 }}>
              Please wait while we capture your visualization
            </div>
          </div>
        </div>
      )}
      
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
        style={{ fontSize: 'clamp(1rem, 2vw, 1.6rem)', padding: '0.5em 1.5em', borderTopRightRadius: 0, borderBottomRightRadius: 0, flexShrink: 0, height: '64px' }}
      >
        Load MIDI
      </button>
      {!testMidiLoaded && (
        <button
          onClick={handleLoadBeethoven}
          className="blend-btn"
          style={{ fontSize: 'clamp(1rem, 2vw, 1.6rem)', padding: '0.5em 1.5em', borderRadius: 0, flexShrink: 0, height: '64px' }}
        >
          Example Song
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
          
          {/* Export Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 8, flexShrink: 0 }}>
            <button
              onClick={handleExportImage}
              className="blend-btn midi-theme-btn"
              style={{
                fontSize: '0.8rem',
                padding: '0.3em 0.6em',
                borderRadius: 0,
                transition: 'background 0.2s, color 0.2s',
                cursor: 'pointer',
                flexShrink: 0,
                backgroundColor: '#4CAF50',
                color: 'white'
              }}
              title="Export current visualization as PNG image"
            >
              📷 PNG
            </button>
            <button
              id="export-video-btn"
              onClick={handleExportVideo}
              className="blend-btn midi-theme-btn"
              style={{
                fontSize: '0.8rem',
                padding: '0.3em 0.6em',
                borderRadius: 0,
                transition: 'background 0.2s, color 0.2s',
                cursor: 'pointer',
                flexShrink: 0,
                backgroundColor: '#2196F3',
                color: 'white'
              }}
              title="Record 10 seconds of visualization as video"
            >
              🎬 Export Video
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
} 