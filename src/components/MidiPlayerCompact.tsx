'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import type { MidiData, MidiNote, MidiChord } from '@/hooks/useMidiPlayer';
import { useMidiContext } from '@/contexts/MidiContext';
import { VirtualTonnetz } from './VirtualTonnetz';
import ExportVideoModal from './ExportVideoModal';
import LoadModal from './LoadModal';
import * as Tone from 'tone';
import { Play, Pause, Square, FolderUp, FileDown, Loader2, Volume2, VolumeX } from 'lucide-react';
import fixWebmDuration from 'webm-duration-fix';
import { convertAudioToMidi, isAudioFile } from '@/utils/audioToMidi';
import { getAudioToMidiWorker } from '@/utils/audioToMidiWorker';
import { useYouTubeMP3 } from '@/hooks/useYouTubeMP3';

interface MidiPlayerCompactProps {
  onNoteStart?: (note: MidiNote) => void;
  onNoteEnd?: (note: MidiNote) => void;
  onChordStart?: (chord: MidiChord) => void;
  onChordEnd?: (chord: MidiChord) => void;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  mode: 'note' | 'chord' | 'arpeggio';
  chordType: string;
}

const MIRARI_WATERMARK_SRC = '/mirari-w.png';

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
  const { getCanvasCallbacks, getMidiPlayerState, getMidiPlayerFunctions, isMuted, toggleMute } = useMidiContext();
  
  // YouTube MP3 hook
  const { downloadMP3FromUrl } = useYouTubeMP3();
  
  // Track if test MIDI has been loaded
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  
  // Audio to MIDI conversion state
  const [isConverting, setIsConverting] = useState(false);
  const [conversionStatus, setConversionStatus] = useState<string | null>(null);
  const [conversionProgress, setConversionProgress] = useState(0);
  
  // Export progress tracking
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showCancel, setShowCancel] = useState(false);
  
  // Recording settings and state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const wasCancelled = useRef(false);
  const exportBtnRef = useRef<HTMLButtonElement | null>(null);
  
  // Get shared state from context
  const [playerState, setPlayerState] = useState<{
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    midiData: MidiData | null;
    fileName: string;
    isOriginalAudio?: boolean;
    originalAudioBuffer?: AudioBuffer | null;
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
    parseAudioFile: (file: File, midiData: MidiData) => Promise<void>;
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

  // Auto-set duration from MIDI if available
  React.useEffect(() => {
    if (playerState?.midiData && playerState.duration > 0) {
      // setRecordingSettings(prev => ({ // This line is removed as per the edit hint
      //   ...prev,
      //   duration: playerState.duration
      // }));
    }
  }, [playerState?.midiData, playerState?.duration]);

  // Remove Example Song button and load example MIDI by default
  useEffect(() => {
    if (!playerState?.midiData && playerFunctions) {
      playerFunctions.loadMidiFromUrl('/example.mid', 'Example MIDI');
    }
  }, [playerState?.midiData, playerFunctions]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file || !playerFunctions) return;

    playerFunctions.stopPlayback();
    setConversionStatus(null);
    setConversionProgress(0);

    // Check if it's a MIDI file
    if (file.type === 'audio/midi' || file.name.endsWith('.mid')) {
      await playerFunctions.parseMidiFile(file);
      return;
    }

    // Check if it's an audio file that needs conversion
    if (isAudioFile(file)) {
      setIsConverting(true);
      setConversionStatus('Converting audio to MIDI for visualization...');
      setConversionProgress(0);
      
      try {
        // Convert audio to MIDI for visualization only
        const midiBlob = await convertAudioToMidi(file, {}, (progress) => {
          setConversionProgress(progress.progress);
          setConversionStatus(progress.message);
        });
        
        const midiFile = new File([midiBlob], `${file.name.replace(/\.[^/.]+$/, '')}.mid`, {
          type: 'audio/midi'
        });
        
        setConversionStatus('Loading MIDI for visualization...');
        setConversionProgress(100);
        
        // Parse the MIDI file first to get the MIDI data
        const midiData = await playerFunctions.parseMidiFile(midiFile);
        
        if (midiData) {
          // Then load the original audio file for playback
          setConversionStatus('Loading original audio for playback...');
          await playerFunctions.parseAudioFile(file, midiData);
          setConversionStatus('Ready! Original audio will be played with synchronized MIDI visualization.');
        } else {
          setConversionStatus('Failed to load MIDI data for visualization');
        }
        
        setConversionProgress(0);
        
        // Show a brief success message
        setTimeout(() => {
          setConversionStatus(null);
        }, 2000);
      } catch (error) {
        setConversionStatus(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setConversionProgress(0);
      } finally {
        setIsConverting(false);
        setIsLoadModalOpen(false);
      }
      return;
    }

    // Invalid file type
    setConversionStatus('Please select a valid MIDI or audio file (MP3, WAV, OGG, FLAC, etc.)');
  }, [playerFunctions]);

  const handleFileInputChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleYouTubeUrl = useCallback(async (url: string) => {
    console.log("YouTube handler called with:", url);
    if (!playerFunctions) return;

    let timeoutId: NodeJS.Timeout | null = null;
    const clearTimeoutIfSet = () => { if (timeoutId) clearTimeout(timeoutId); };
    timeoutId = setTimeout(() => {
      setIsConverting(false);
      setConversionStatus('Conversion timed out. Please try a shorter or different audio.');
      setConversionProgress(0);
      console.log('Conversion timed out.');
    }, 60000); // 60 seconds

    playerFunctions.stopPlayback();
    setConversionStatus('Processing YouTube URL...');
    setConversionProgress(0);
    setIsConverting(true);
    console.log('Set isConverting: true, conversionStatus: Processing YouTube URL...');

    try {
      // First, try to download the audio from YouTube
      const response = await downloadMP3FromUrl(url);
      console.log("YouTube API response:", response);
      
      if ('error' in response) {
        clearTimeoutIfSet();
        setConversionStatus(`YouTube processing failed: ${response.error}`);
        setConversionProgress(0);
        setIsConverting(false);
        console.log('Set isConverting: false, conversionStatus:', `YouTube processing failed: ${response.error}`);
        return;
      }
      if ('status' in response && response.status === 'processing') {
        clearTimeoutIfSet();
        setConversionStatus(response.msg || 'The YouTube video is still being processed. Please try again in a few seconds.');
        setConversionProgress(0);
        setIsConverting(false);
        console.log('Set isConverting: false, conversionStatus:', response.msg);
        return;
      }
      if ('status' in response && response.status === 'fail') {
        clearTimeoutIfSet();
        setConversionStatus(response.msg || 'Failed to process the YouTube video.');
        setConversionProgress(0);
        setIsConverting(false);
        console.log('Set isConverting: false, conversionStatus:', response.msg);
        return;
      }
      if ('status' in response && response.status === 'ok') {
        const songTitle = response.result?.[0]?.title || 'YouTube Audio';
        setConversionStatus('Downloading audio from YouTube...');
        setConversionProgress(25);
        console.log('Set conversionStatus: Downloading audio from YouTube..., conversionProgress: 25');

        // Get the download URL from the response
        const downloadUrl = response.result?.[0]?.dlurl;
        if (!downloadUrl) {
          clearTimeoutIfSet();
          setConversionStatus('No download URL received from YouTube API');
          setConversionProgress(0);
          setIsConverting(false);
          console.log('Set isConverting: false, conversionStatus: No download URL received from YouTube API');
          return;
        }

        // Download the audio file
        const audioResponse = await fetch(downloadUrl);
        if (!audioResponse.ok) {
          clearTimeoutIfSet();
          throw new Error(`Failed to download audio: ${audioResponse.status}`);
        }

        const audioBlob = await audioResponse.blob();
        // Sanitize the song title for file names
        const safeTitle = songTitle.replace(/[^a-zA-Z0-9-_\. ]/g, '').replace(/\s+/g, '_');
        const audioFile = new File([audioBlob], `${safeTitle || 'youtube-audio'}.mp3`, { type: 'audio/mpeg' });

        setConversionStatus('Converting audio to MIDI...');
        setConversionProgress(75);
        console.log('Set conversionStatus: Converting audio to MIDI..., conversionProgress: 75');

        // Convert the audio to MIDI using the existing functionality
        const midiBlob = await convertAudioToMidi(audioFile, {}, (progress) => {
          setConversionProgress(75 + (progress.progress * 0.25)); // 75% to 100%
          setConversionStatus(progress.message);
          console.log('Progress update:', progress);
        });

        const midiFile = new File([midiBlob], `${safeTitle || 'youtube-audio'}.mid`, { type: 'audio/midi' });

        setConversionStatus('Loading MIDI for visualization...');
        setConversionProgress(100);
        console.log('Set conversionStatus: Loading MIDI for visualization..., conversionProgress: 100');

        // Parse the MIDI file
        const midiData = await playerFunctions.parseMidiFile(midiFile);
        
        if (midiData) {
          // Load the original audio file for playback
          await playerFunctions.parseAudioFile(audioFile, midiData);
          setConversionStatus('YouTube audio loaded successfully!');
          console.log('Set conversionStatus: YouTube audio loaded successfully!');
        } else {
          setConversionStatus('Failed to load MIDI data for visualization');
          console.log('Set conversionStatus: Failed to load MIDI data for visualization');
        }

        clearTimeoutIfSet();
        // Show success message briefly
        setTimeout(() => {
          setConversionStatus(null);
          setIsConverting(false);
          setConversionProgress(0);
          setIsLoadModalOpen(false);
          console.log('Reset modal state and closed modal');
        }, 2000);
      }
    } catch (error) {
      clearTimeoutIfSet();
      setConversionStatus(`YouTube processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setConversionProgress(0);
      setIsConverting(false);
      console.log('Set isConverting: false, conversionStatus:', error);
    }
  }, [playerFunctions, downloadMP3FromUrl]);

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

  const handleCancelConversion = useCallback(() => {
    if (isConverting) {
      const worker = getAudioToMidiWorker();
      worker.cancel();
      setIsConverting(false);
      setConversionStatus('Conversion cancelled');
      setConversionProgress(0);
    }
  }, [isConverting]);

  // Callback to render a frame at a specific time for video recording
  const triggerVirtualExport = useCallback(async (settings: {
    targetWidth: number;
    aspectRatio: string;
    targetFrameRate: number;
    includeAudio: boolean;
    startTime: number;
    endTime: number;
    exportFileName?: string;
    midiData?: MidiData | null;
    mode?: 'note' | 'chord' | 'arpeggio';
    chordType?: string;
    zoom?: number;
  }) => {
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

    // Helper function to create audio stream from AudioBuffer with time range
    const createAudioStreamFromBuffer = (audioBuffer: AudioBuffer, startTime: number, endTime: number): MediaStream => {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      const dest = audioContext.createMediaStreamDestination();
      source.connect(dest);
      
      // Start the audio source at the specified start time
      source.start(0, startTime, endTime - startTime);
      
      return dest.stream;
    };

    if (settings.includeAudio) {
      // Check if we have original audio available
      if (playerState?.isOriginalAudio && playerState?.originalAudioBuffer) {
        console.log('Using original audio for export');
        const originalAudioStream = createAudioStreamFromBuffer(playerState.originalAudioBuffer, settings.startTime, settings.endTime);
        finalStream = new MediaStream([
          ...videoStream.getTracks(),
          ...originalAudioStream.getTracks()
        ]);
      } else if (midiData) {
        // Fallback to synthesized MIDI audio
        console.log('Using synthesized MIDI audio for export');
        await Tone.start();
        synth = new Tone.PolySynth({ maxPolyphony: 64, voice: Tone.Synth });
        synth.disconnect();
        audioDest = Tone.Destination.context.createMediaStreamDestination();
        synth.connect(audioDest);
        synth.set({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 }
        });
        Tone.Transport.cancel();
        midiData.tracks.forEach((track: { notes: Array<{ note: string; time: number; duration: number; velocity: number; midi: number }> }) => {
          track.notes.forEach((note: { note: string; time: number; duration: number; velocity: number; midi: number }) => {
            // Only schedule notes that fall within the export time range
            if (note.time >= settings.startTime && note.time < settings.endTime) {
              const adjustedTime = note.time - settings.startTime;
              Tone.Transport.schedule((time) => {
                if (!isMuted && synth) {
                  synth.triggerAttack(note.note, time, note.velocity);
                }
              }, adjustedTime);
              Tone.Transport.schedule((time) => {
                if (!isMuted && synth) {
                  synth.triggerRelease(note.note, time);
                }
              }, adjustedTime + note.duration);
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
        cancelAnimationFrame(animationFrameRef.current);
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
    mediaRecorder.onstop = async () => {
      if (!wasCancelled.current) {
        // Use webm-duration-fix to correct the duration metadata
        const exportDuration = settings.endTime - settings.startTime;
        const fixedBlob = await fixWebmDuration(new Blob(chunks, { type: selectedMimeType }), exportDuration * 1000);
        const url = URL.createObjectURL(fixedBlob);
        const a = document.createElement('a');
        a.href = url;
        const audioType = playerState?.isOriginalAudio ? '-original-audio' : settings.includeAudio ? '-with-audio' : '';
        const exportBase = settings.exportFileName || playerState?.fileName || 'virtual-recording';
        a.download = `${exportBase}-${Date.now()}${audioType}.webm`;
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
    const virtualTonnetz = new VirtualTonnetz(hiddenCanvas, ctx, {
      mode: settings.mode || mode,
      chordType: settings.chordType || chordType,
      density: Math.round(20 / (settings.zoom || 1.0))
    });

    // Load watermark image
    const watermarkImg = new window.Image();
    watermarkImg.src = MIRARI_WATERMARK_SRC;
    await new Promise((resolve, reject) => {
      watermarkImg.onload = resolve;
      watermarkImg.onerror = reject;
    });

    // Use a more robust timing mechanism that doesn't get throttled by the browser
    const exportDuration = settings.endTime - settings.startTime;
    const totalFrames = Math.ceil((exportDuration * settings.targetFrameRate));
    let frame = 0;
    const timeStep = exportDuration / totalFrames;
    const startTime = performance.now();
    const frameInterval = 1000 / settings.targetFrameRate;
    
    function renderNextFrame() {
      const currentTime = performance.now();
      const elapsedTime = currentTime - startTime;
      const expectedFrame = Math.floor(elapsedTime / frameInterval);
      
      // Render all frames that should have been rendered by now
      while (frame <= expectedFrame && frame < totalFrames) {
        const simulationTime = settings.startTime + (frame * timeStep);
        // Update the virtual tonnetz with the current time
        if (virtualTonnetz && playerState?.midiData && playerState.midiData !== null) {
          virtualTonnetz.update(simulationTime, playerState.midiData);
        }
        
        // Draw watermark at bottom right
        if (ctx && watermarkImg.complete) {
          // Use the smaller dimension to calculate watermark size for consistent appearance across aspect ratios
          const smallerDimension = Math.min(hiddenCanvas.width, hiddenCanvas.height);
          const margin = Math.round(smallerDimension * 0.03);
          const extraMargin = Math.round(smallerDimension * 0.05); // 5% more inward
          const logoSize = Math.round(smallerDimension * 0.08); // 8% of smaller dimension (square)
          const logoX = hiddenCanvas.width - logoSize - margin - extraMargin;
          const logoY = hiddenCanvas.height - logoSize - margin - extraMargin;
          const cornerRadius = Math.round(logoSize * 0.25);
          ctx.save();
          ctx.globalAlpha = 0.85;
          // Draw black rounded square behind the logo
          ctx.beginPath();
          ctx.moveTo(logoX + cornerRadius, logoY);
          ctx.lineTo(logoX + logoSize - cornerRadius, logoY);
          ctx.arcTo(logoX + logoSize, logoY, logoX + logoSize, logoY + cornerRadius, cornerRadius);
          ctx.lineTo(logoX + logoSize, logoY + logoSize - cornerRadius);
          ctx.arcTo(logoX + logoSize, logoY + logoSize, logoX + logoSize - cornerRadius, logoY + logoSize, cornerRadius);
          ctx.lineTo(logoX + cornerRadius, logoY + logoSize);
          ctx.arcTo(logoX, logoY + logoSize, logoX, logoY + logoSize - cornerRadius, cornerRadius);
          ctx.lineTo(logoX, logoY + cornerRadius);
          ctx.arcTo(logoX, logoY, logoX + cornerRadius, logoY, cornerRadius);
          ctx.closePath();
          ctx.fillStyle = 'black';
          ctx.fill();
          // Draw the watermark image centered in the square
          // Fit image inside the square, maintaining aspect ratio
          let drawW = logoSize, drawH = logoSize;
          const aspect = watermarkImg.width / watermarkImg.height;
          if (aspect > 1) {
            drawH = logoSize / aspect;
          } else {
            drawW = logoSize * aspect;
          }
          const drawX = logoX + (logoSize - drawW) / 2;
          const drawY = logoY + (logoSize - drawH) / 2;
          ctx.drawImage(
            watermarkImg,
            drawX,
            drawY,
            drawW,
            drawH
          );
          ctx.globalAlpha = 1.0;
          ctx.restore();
        }
        
        frame++;
      }
      
      // Update progress
      const progress = (frame / totalFrames) * 100;
      setExportProgress(progress);
      
      if (frame < totalFrames) {
        // Use requestAnimationFrame for better performance and to avoid throttling
        animationFrameRef.current = requestAnimationFrame(renderNextFrame);
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
      cancelAnimationFrame(animationFrameRef.current);
    }
  }
  }, [isMuted, playerState?.fileName, playerState?.isOriginalAudio, playerState?.originalAudioBuffer, canvasRef, playerState?.midiData, mode, chordType]);

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
        display: 'inline-flex',
        alignItems: 'stretch',
        gap: 0,
        fontSize: '0.9rem',
        flexWrap: 'nowrap',
        whiteSpace: 'nowrap',
        width: 'auto',
        height: '64px',
      }}>
        {/* Hidden file input for direct file selection */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".mid,audio/midi,audio/*,.mp3,.wav,.ogg,.flac,.aac,.m4a,.webm"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => setIsLoadModalOpen(true)}
          className="blend-btn"
          disabled={isConverting}
        >
          {isConverting ? (
            <>
              <Loader2 className="load-icon animate-spin" />
              <span className="load-text">Converting...</span>
            </>
          ) : (
            <>
              <FolderUp className="load-icon" />
              <span className="load-text">Load</span>
            </>
          )}
        </button>
        {/* Playback Controls and Export Button */}
        {playerState?.midiData && (
          <>
            <button
              onClick={handlePlayPause}
              className="blend-btn"
            >
              {playerState.isPlaying ? <Pause className="playback-icon" /> : <Play className="playback-icon" />}
            </button>
            <button
              onClick={handleStop}
              className="blend-btn"
            >
              <Square className="playback-icon" />
            </button>
            <button
              onClick={toggleMute}
              className="blend-btn"
              title={isMuted ? 'Unmute synthesizer' : 'Mute synthesizer'}
            >
              {isMuted ? <VolumeX className="playback-icon" /> : <Volume2 className="playback-icon" />}
            </button>
            {/* Centered non-button controls */}
            <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              {/* Progress Bar (visible on desktop, hidden on mobile via CSS) */}
              <div className="midi-progress-bar-container" style={{ width: '120px', marginLeft: 8, flexShrink: 0, display: 'flex', alignItems: 'center', height: '100%' }}>
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
                    cursor: 'pointer',
                    position: 'relative',
                    zIndex: 2
                  }}
                />
              </div>
              {/* Time Display and Filename */}
              <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <span className="midi-time-display" style={{ fontSize: '0.8rem', opacity: 0.8, minWidth: '60px', marginLeft: 8, flexShrink: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                  {formatTime(playerState.currentTime)} / {formatTime(playerState.duration)}
                </span>
                <span className="song-title" style={{ fontSize: '0.8rem', opacity: 0.7, maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 8, flexShrink: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                  {playerState.fileName}
                  {playerState.isOriginalAudio && (
                    <span style={{ 
                      fontSize: '0.7rem', 
                      opacity: 0.6, 
                      marginLeft: 4,
                      fontStyle: 'italic'
                    }}>
                      (Original Audio)
                    </span>
                  )}
                </span>
              </div>
            </div>
            {/* Export Video Button */}
            <div
              style={{
                position: 'relative',
                display: 'inline-block',
                marginLeft: 8
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
                title={isExporting && showCancel ? 'Cancel export' : isExporting ? 'Exporting video...' : 'Export video with settings'}
              >
                {/* Visually hidden span to reserve space for the longest text */}
                <span style={{visibility: 'hidden', position: 'absolute', pointerEvents: 'none', height: 0, overflow: 'hidden'}}>
                  Exporting 100%
                </span>
                {isExporting && showCancel
                  ? 'Cancel'
                  : isExporting
                    ? <>Exporting {exportProgress.toFixed(0)}%</>
                    : <><FileDown className="export-icon" /><span className="export-text">Export</span></>}
              </button>
            </div>
          </>
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
        midiData={playerState?.midiData ?? undefined}
        mode={mode}
        chordType={chordType}
        fileName={playerState?.fileName}
      />

      {/* Load Modal */}
      <LoadModal
        isOpen={isLoadModalOpen}
        onClose={() => setIsLoadModalOpen(false)}
        onFileSelect={handleFileSelect}
        onYouTubeUrl={handleYouTubeUrl}
        isConverting={isConverting}
        conversionStatus={conversionStatus}
        conversionProgress={conversionProgress}
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

      {/* Conversion Progress Overlay */}
      {isConverting && (
        <div className="export-modal-overlay" style={{ zIndex: 1000 }}>
          <div
            className="export-modal-outer"
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: '24px',
              paddingBottom: '24px',
            }}
          >
            <div
              className="export-modal"
              style={{
                position: 'relative',
                padding: '48px 32px 32px 32px',
                borderRadius: '18px',
                background: 'var(--color-main)',
                boxShadow: '0 4px 32px rgba(0,0,0,0.18)',
                minWidth: 360,
                minHeight: 180,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {/* Spinner */}
              <div style={{ marginBottom: '1rem' }}>
                <Loader2
                  className="animate-spin"
                  style={{
                    fontSize: '2.5rem',
                    color: 'var(--color-accent)',
                    display: 'block',
                    margin: '0 auto'
                  }}
                />
              </div>
              <h3 style={{ margin: '0.5rem 0', fontSize: '1.2rem', color: '#fff', fontWeight: 600 }}>Converting Audio to MIDI</h3>
              <p style={{ margin: '0.5rem 0', fontSize: '1rem', color: '#fff', opacity: 0.9 }}>{conversionStatus}</p>
              {/* Progress Bar */}
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#222',
                borderRadius: '4px',
                overflow: 'hidden',
                margin: '16px 0',
              }}>
                <div style={{
                  width: `${conversionProgress}%`,
                  height: '100%',
                  backgroundColor: 'var(--color-accent)',
                  borderRadius: '4px',
                  transition: 'width 0.3s',
                }} />
              </div>
              <div style={{ fontSize: '0.9rem', color: '#fff', opacity: 0.7, marginBottom: '1rem' }}>
                {conversionProgress.toFixed(0)}% complete
              </div>
              <button
                onClick={handleCancelConversion}
                className="blend-btn"
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '10px 24px',
                  fontWeight: 500,
                  fontSize: 16,
                  marginTop: 16,
                }}
              >
                Cancel Conversion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Progress Overlay */}
    </>
  );
} 