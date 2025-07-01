'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import type { MidiData, MidiNote, MidiChord } from '@/hooks/useMidiPlayer';
import { useMidiContext } from '@/contexts/MidiContext';
import { createVirtualTonnetz, VirtualTonnetz } from './VirtualTonnetz';
import ExportVideoModal from './ExportVideoModal';
import VirtualCanvasRecorder from './VirtualCanvasRecorder';
import * as Tone from 'tone';
import { Play, Pause, Square, Video } from 'lucide-react';

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
  canvasRef: userCanvasRef,
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Export progress tracking
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showCancel, setShowCancel] = useState(false);
  
  // Recording settings and state
  const [recordingSettings, setRecordingSettings] = useState({
    duration: 30,
    speedMultiplier: 1,
    targetFrameRate: 30,
    includeAudio: false,
    aspectRatio: 'original' as string,
    targetWidth: 1920,
    zoom: 1.0
  });
  const virtualTonnetzRef = useRef<VirtualTonnetz | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const animationFrameRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const wasCancelled = useRef(false);
  const exportBtnRef = useRef<HTMLButtonElement | null>(null);
  
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

  // Ensure we always have a valid canvas ref
  const fallbackCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = userCanvasRef ?? fallbackCanvasRef;

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

  // Auto-set duration from MIDI if available
  React.useEffect(() => {
    if (playerState?.midiData && playerState.duration > 0) {
      setRecordingSettings(prev => ({
        ...prev,
        duration: playerState.duration
      }));
    }
  }, [playerState?.midiData, playerState?.duration]);

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

  // Cancel export function
  const handleCancelExport = useCallback(() => {
    wasCancelled.current = true;
    if (mediaRecorderRef.current && isExporting) {
      mediaRecorderRef.current.stop();
    }
    if (animationFrameRef.current) {
      clearTimeout(animationFrameRef.current);
    }
    // Reset export state
    setIsExporting(false);
    setExportProgress(0);
    setShowCancel(false);
  }, [isExporting]);



  // Callback to render a frame at a specific time for video recording
  const handleRenderFrame = useCallback((canvas: HTMLCanvasElement, time: number) => {
    // Initialize VirtualTonnetz if not already done
    if (!virtualTonnetzRef.current) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Calculate density based on zoom (higher zoom = lower density = nodes closer together)
        const baseDensity = 20;
        const density = Math.round(baseDensity / recordingSettings.zoom);
        virtualTonnetzRef.current = new VirtualTonnetz(canvas, ctx, { 
          mode, 
          chordType,
          density 
        });
      }
    }
    
    // Update the virtual tonnetz with the current time
    if (virtualTonnetzRef.current && playerState?.midiData) {
      virtualTonnetzRef.current.update(time, playerState.midiData);
    }
  }, [recordingSettings.zoom, mode, chordType, playerState?.midiData]);

  // Remove isRecording and VirtualCanvasRecorder overlay state
  // Add a function to programmatically trigger the virtual canvas export
  const triggerVirtualExport = useCallback(async (settings: any) => {
    try {
          // Set export state
    setIsExporting(true);
    setExportProgress(0);
      
      // Create a hidden canvas
      const hiddenCanvas = document.createElement('canvas');
      hiddenCanvas.style.position = 'fixed';
      hiddenCanvas.style.left = '-9999px';
      hiddenCanvas.style.top = '-9999px';
      document.body.appendChild(hiddenCanvas);

    // Calculate dimensions based on aspect ratio
    const originalCanvas = canvasRef.current;
    if (!originalCanvas) return;
    let width = settings.targetWidth;
    let height = settings.targetWidth;
    switch (settings.aspectRatio) {
      case '16:9':
        // Landscape: width = targetWidth, height calculated
        width = settings.targetWidth;
        height = Math.round(settings.targetWidth * 9 / 16);
        break;
      case '9:16':
        // Portrait: height = targetWidth, width calculated
        height = settings.targetWidth;
        width = Math.round(settings.targetWidth * 9 / 16);
        break;
      case '4:3':
        width = settings.targetWidth;
        height = Math.round(settings.targetWidth * 3 / 4);
        break;
      case '1:1':
        width = settings.targetWidth;
        height = settings.targetWidth;
        break;
      case 'original':
      default:
        // Keep original aspect ratio but scale to target width
        const scale = settings.targetWidth / originalCanvas.width;
        width = settings.targetWidth;
        height = Math.round(originalCanvas.height * scale);
        break;
    }
    hiddenCanvas.width = width;
    hiddenCanvas.height = height;

    const ctx = hiddenCanvas.getContext('2d');
    if (!ctx || !originalCanvas) {
      document.body.removeChild(hiddenCanvas);
      // Reset export state on error
      setIsExporting(false);
      setExportProgress(0);
      setShowCancel(false);
      mediaRecorderRef.current = null;
      if (animationFrameRef.current) {
        clearTimeout(animationFrameRef.current);
      }
      return;
    }

    // Prepare for recording
    const videoStream = hiddenCanvas.captureStream(settings.targetFrameRate);
    let finalStream: MediaStream = videoStream;
    let synth: Tone.PolySynth | null = null;
    let audioDest: MediaStreamAudioDestinationNode | null = null;
    let scheduled = false;
    const midiData = settings.midiData || playerState?.midiData;

    if (settings.includeAudio && midiData) {
      await Tone.start();
      synth = new Tone.PolySynth({ maxPolyphony: 32, voice: Tone.Synth });
      synth.disconnect();
      audioDest = Tone.Destination.context.createMediaStreamDestination();
      synth.connect(audioDest);
      synth.set({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 }
      });
      Tone.Transport.cancel();
      midiData.tracks.forEach((track: any) => {
        track.notes.forEach((note: any) => {
          if (note.time < settings.duration) {
            Tone.Transport.schedule((time) => {
              synth?.triggerAttack(note.note, time, note.velocity);
            }, note.time);
            Tone.Transport.schedule((time) => {
              synth?.triggerRelease(note.note, time);
            }, note.time + note.duration);
          }
        });
      });
      Tone.Transport.bpm.value = midiData.tempo || 120;
      finalStream = new MediaStream([
        ...videoStream.getTracks(),
        ...audioDest.stream.getTracks()
      ]);
      scheduled = true;
    }

    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];
    let selectedMimeType = '';
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        selectedMimeType = mimeType;
        break;
      }
    }
    if (!selectedMimeType) {
      document.body.removeChild(hiddenCanvas);
      // Reset export state on error
      setIsExporting(false);
      setExportProgress(0);
      setShowCancel(false);
      mediaRecorderRef.current = null;
      if (animationFrameRef.current) {
        clearTimeout(animationFrameRef.current);
      }
      return;
    }
    const mediaRecorder = new MediaRecorder(finalStream, { mimeType: selectedMimeType });
    mediaRecorderRef.current = mediaRecorder;
    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    mediaRecorder.onstop = () => {
      if (!wasCancelled.current) {
        const blob = new Blob(chunks, { type: selectedMimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `virtual-recording-${Date.now()}${settings.includeAudio ? '-with-audio' : ''}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      }
      wasCancelled.current = false;
      document.body.removeChild(hiddenCanvas);
      if (scheduled) {
        Tone.Transport.stop();
        Tone.Transport.cancel();
        synth?.dispose();
      }
      
      // Reset export state
      setIsExporting(false);
      setExportProgress(0);
      setShowCancel(false);
      mediaRecorderRef.current = null;
    };
    mediaRecorder.start();

    // --- Use VirtualTonnetz for rendering frames ---
    const density = Math.round(20 / settings.zoom);
    const virtualTonnetz = new VirtualTonnetz(hiddenCanvas, ctx, {
      mode: settings.mode || mode,
      chordType: settings.chordType || chordType,
      density
    });

    const totalFrames = Math.ceil((settings.duration * settings.targetFrameRate));
    let frame = 0;
    const timeStep = settings.duration / totalFrames;
    function renderNextFrame() {
      const simulationTime = frame * timeStep;
      if (virtualTonnetz && midiData) {
        virtualTonnetz.update(simulationTime, midiData);
      }
      
      // Update progress
      const progress = (frame / totalFrames) * 100;
      setExportProgress(progress);
      
      frame++;
      if (frame < totalFrames) {
        animationFrameRef.current = setTimeout(renderNextFrame, 1000 / settings.targetFrameRate);
      } else {
        mediaRecorder.stop();
      }
    }
    if (scheduled) {
      Tone.Transport.start();
    }
    renderNextFrame();
  } catch (error) {
    console.error('Export failed:', error);
    // Reset export state on error
    setIsExporting(false);
    setExportProgress(0);
    setShowCancel(false);
    mediaRecorderRef.current = null;
    if (animationFrameRef.current) {
      clearTimeout(animationFrameRef.current);
    }
  }
  }, [canvasRef, mode, chordType, playerState?.midiData]);

  return (
    <>
      {/* Recording Modal Overlay */}
      {/* {isRecording && (
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
      )} */}
      
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 0, flexShrink: 0, height: '64px' }}>
          <button
            onClick={handlePlayPause}
            className="blend-btn"
            style={{
              width: '64px',
              height: '100%',
              fontSize: '1rem',
              padding: 0,
              borderRadius: 0,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {playerState.isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={handleStop}
            className="blend-btn"
            style={{
              width: '64px',
              height: '100%',
              fontSize: '1rem',
              padding: 0,
              borderRadius: 0,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Square size={20} />
          </button>
          {/* Progress Bar */}
          <div style={{ width: '120px', marginLeft: 8, flexShrink: 0 }}>
            <input
              type="range"
              className="midi-progress-bar"
              min={0}
              max={playerState.duration || 0}
              value={playerState.currentTime || 0}
              onChange={handleSeek}
              step={0.1}
              style={{
                width: '100%',
                height: '4px',
                borderRadius: '2px',
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
          
                      {/* Export Video Button */}
            <div
              style={{
                position: 'relative',
                display: 'inline-block'
              }}
              onMouseEnter={() => isExporting && setShowCancel(true)}
              onMouseLeave={() => setShowCancel(false)}
            >
              <button
                ref={exportBtnRef}
                onClick={() => {
                  if (isExporting && showCancel) {
                    handleCancelExport();
                    exportBtnRef.current?.blur();
                  } else if (!isExporting) {
                    setIsModalOpen(true);
                    setTimeout(() => exportBtnRef.current?.blur(), 0);
                  }
                }}
                disabled={isExporting && !showCancel}
                className="blend-btn"
                style={{
                  fontSize: 'clamp(0.9rem, 2vw, 1.1rem)',
                  padding: '0.5em 0',
                  borderRadius: 0,
                  flexShrink: 0,
                  minWidth: '140px',
                  maxWidth: '220px',
                  width: 'clamp(140px, 15vw, 220px)',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                  position: 'relative',
                  zIndex: 1
                }}
                title={isExporting && showCancel ? 'Cancel export' : isExporting ? 'Exporting video...' : 'Export video with settings'}
              >
                {/* Visually hidden span to reserve space for the longest text */}
                <span style={{visibility: 'hidden', position: 'absolute', pointerEvents: 'none', height: 0, overflow: 'hidden'}}>
                  <Square size={16} /> Exporting 100%
                </span>
                {isExporting && showCancel
                  ? 'Cancel'
                  : isExporting
                    ? <><Square size={16} /> Exporting {exportProgress.toFixed(0)}%</>
                    : 'EXPORT TO VIDEO'}
              </button>
            </div>
        </div>
      )}
    </div>

    {/* Export Video Modal */}
    <ExportVideoModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      onExport={(settings) => {
        setIsModalOpen(false);
        triggerVirtualExport(settings);
      }}
      originalCanvasRef={canvasRef as React.RefObject<HTMLCanvasElement>}
      midiData={playerState?.midiData}
      mode={mode}
      chordType={chordType}
    />

    {/* VirtualCanvasRecorder - only shown when recording */}
    {/* {isRecording && (
      <VirtualCanvasRecorder
        originalCanvasRef={canvasRef as React.RefObject<HTMLCanvasElement>}
        onRenderFrame={handleRenderFrame}
        duration={recordingSettings.duration}
        speedMultiplier={recordingSettings.speedMultiplier}
        targetFrameRate={recordingSettings.targetFrameRate}
        includeAudio={recordingSettings.includeAudio}
        aspectRatio={recordingSettings.aspectRatio}
        targetWidth={recordingSettings.targetWidth}
        zoom={recordingSettings.zoom}
        midiData={playerState?.midiData}
        onRecordingStart={handleRecordingStart}
        onRecordingStop={handleRecordingStop}
        onProgress={handleProgress}
      />
    )} */}
    </>
  );
} 