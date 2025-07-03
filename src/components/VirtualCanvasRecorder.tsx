'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Square, Video, Music } from 'lucide-react';
import * as Tone from 'tone';
import fixWebmDuration from 'webm-duration-fix';
import { useMidiContext } from '@/contexts/MidiContext';

interface VirtualCanvasRecorderProps {
  // Original canvas ref for getting dimensions and context
  originalCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  // Callback to render a frame at a specific time
  onRenderFrame: (canvas: HTMLCanvasElement, time: number) => void;
  // Total duration to record (in seconds)
  duration: number;
  // Speed multiplier (1 = real-time, 2 = 2x speed, 0.5 = half speed)
  speedMultiplier: number;
  // Frame rate for the output video
  targetFrameRate: number;
  // Whether to include audio in the recording
  includeAudio?: boolean;
  // MIDI data for audio synthesis during recording
  midiData?: any;
  // Original audio buffer for recording (if available)
  originalAudioBuffer?: AudioBuffer | null;
  // Whether original audio should be used instead of synthesized MIDI
  isOriginalAudio?: boolean;
  // Aspect ratio for the output video ('original', '16:9', '9:16', '4:3', '1:1')
  aspectRatio?: string;
  // Target width for the output video (height will be calculated based on aspect ratio)
  targetWidth?: number;
  // Zoom level for the output video (0.5 = 50%, 2.0 = 200%)
  zoom?: number;
  onRecordingStart?: () => void;
  onRecordingStop?: (blob: Blob) => void;
  onProgress?: (progress: number) => void;
}

export default function VirtualCanvasRecorder({
  originalCanvasRef,
  onRenderFrame,
  duration,
  speedMultiplier,
  targetFrameRate = 30,
  includeAudio = false,
  midiData,
  originalAudioBuffer,
  isOriginalAudio = false,
  aspectRatio = 'original',
  targetWidth = 1920,
  zoom = 1.0,
  onRecordingStart,
  onRecordingStop,
  onProgress
}: VirtualCanvasRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [progress, setProgress] = useState(0);
  const virtualCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0);
  const audioSynthRef = useRef<Tone.PolySynth | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Get mute state from MIDI context
  const { isMuted } = useMidiContext();

  // Check if MediaRecorder is supported
  useEffect(() => {
    setIsSupported(!!window.MediaRecorder);
  }, []);

  // Initialize audio synth for recording
  const initializeAudio = useCallback(async () => {
    if (!includeAudio || !midiData) return null;

    await Tone.start();
    
    // Create a synth for recording
    const synth = new Tone.PolySynth({ maxPolyphony: 64, voice: Tone.Synth }).toDestination();
    synth.set({
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.3,
        release: 1
      }
    });

    // For automated recording, we'll use a different approach
    // We'll create the audio during the recording process
    return {
      synth,
      stream: null
    };
  }, [includeAudio, midiData]);

  // Helper function to calculate dimensions based on aspect ratio
  const calculateDimensions = useCallback((originalWidth: number, originalHeight: number) => {
    let width: number;
    let height: number;
    
    switch (aspectRatio) {
      case '16:9':
        width = targetWidth;
        height = Math.round(targetWidth * (9 / 16));
        break;
      case '9:16':
        width = targetWidth;
        height = Math.round(targetWidth * (16 / 9));
        break;
      case '4:3':
        width = targetWidth;
        height = Math.round(targetWidth * (3 / 4));
        break;
      case '1:1':
        width = targetWidth;
        height = targetWidth;
        break;
      case 'original':
      default:
        // Keep original aspect ratio but scale to target width
        const scale = targetWidth / originalWidth;
        width = targetWidth;
        height = Math.round(originalHeight * scale);
        break;
    }
    
    return { width, height };
  }, [aspectRatio, targetWidth]);

  const startVirtualRecording = useCallback(async () => {
    if (!originalCanvasRef.current || !virtualCanvasRef.current || !isSupported) return;

    const originalCanvas = originalCanvasRef.current;
    const virtualCanvas = virtualCanvasRef.current;
    
    // Calculate dimensions based on aspect ratio
    const { width: targetCanvasWidth, height: targetCanvasHeight } = calculateDimensions(
      originalCanvas.width, 
      originalCanvas.height
    );
    
    // Set virtual canvas to target dimensions with extra width for border nodes
    const extraWidth = Math.max(100, targetCanvasWidth * 0.1); // Add 10% or at least 100px
    virtualCanvas.width = targetCanvasWidth + extraWidth;
    virtualCanvas.height = targetCanvasHeight;
    
    // Get the virtual canvas context
    const virtualCtx = virtualCanvas.getContext('2d');
    if (!virtualCtx) return;

    // Calculate timing
    const frameInterval = 1000 / targetFrameRate; // milliseconds per frame
    const totalFrames = Math.ceil((duration * 1000) / frameInterval);
    const timeStep = (duration * 1000) / totalFrames; // milliseconds per frame in simulation time
    
    console.log(`Recording ${totalFrames} frames at ${targetFrameRate}fps, ${speedMultiplier}x speed`);

    // Create stream from virtual canvas
    const canvasStream = virtualCanvas.captureStream(targetFrameRate);

    // Initialize audio if needed
    let finalStream = canvasStream;
    
    // Helper function to create audio stream from AudioBuffer
    const createAudioStreamFromBuffer = (audioBuffer: AudioBuffer): MediaStream => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      const dest = audioContext.createMediaStreamDestination();
      source.connect(dest);
      
      // Start the audio source
      source.start(0);
      
      return dest.stream;
    };

    if (includeAudio) {
      // Check if we have original audio available
      if (isOriginalAudio && originalAudioBuffer) {
        console.log('Using original audio for recording');
        const originalAudioStream = createAudioStreamFromBuffer(originalAudioBuffer);
        finalStream = new MediaStream([
          ...canvasStream.getTracks(),
          ...originalAudioStream.getTracks()
        ]);
      } else if (midiData) {
        // Fallback to synthesized MIDI audio
        console.log('Using synthesized MIDI audio for recording');
        try {
          const audioSetup = await initializeAudio();
          if (audioSetup) {
            audioSynthRef.current = audioSetup.synth;
            console.log('Audio synthesis enabled (visual recording only)');
          }
        } catch (error) {
          console.warn('Failed to initialize audio for recording:', error);
        }
      }
    }

    // Try different MIME types for better browser compatibility
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
      console.error('No supported video MIME type found');
      return;
    }

    try {
      const mediaRecorder = new MediaRecorder(finalStream, {
        mimeType: selectedMimeType
      });

      const chunks: Blob[] = [];
      let frameCount = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Use webm-duration-fix to correct the duration metadata
        const fixedBlob = await fixWebmDuration(new Blob(chunks, { type: selectedMimeType }), duration * 1000);
        onRecordingStop?.(fixedBlob);
        
        // Auto-download the video
        const url = URL.createObjectURL(fixedBlob);
        const a = document.createElement('a');
        a.href = url;
        const audioType = isOriginalAudio ? '-original-audio' : includeAudio ? '-with-audio' : '';
        a.download = `virtual-recording${audioType}-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        
        // Cleanup audio
        if (audioSynthRef.current) {
          audioSynthRef.current.dispose();
          audioSynthRef.current = null;
        }
        audioStreamRef.current = null;
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      onRecordingStart?.();

      // Start the virtual rendering loop
      startTimeRef.current = performance.now();
      currentTimeRef.current = 0;

      // Schedule MIDI notes for audio if enabled
      if (includeAudio && midiData && audioSynthRef.current) {
        // Stop any existing transport
        Tone.Transport.stop();
        Tone.Transport.cancel();
        
        // Schedule all notes for the recording duration
        midiData.tracks.forEach((track: any) => {
          track.notes.forEach((note: any) => {
            // Only schedule notes within the recording duration
            if (note.time < duration) {
              Tone.Transport.schedule((time) => {
                if (!isMuted && audioSynthRef.current) {
                  audioSynthRef.current.triggerAttack(note.note, time, note.velocity);
                }
              }, note.time);

              Tone.Transport.schedule((time) => {
                if (!isMuted && audioSynthRef.current) {
                  audioSynthRef.current.triggerRelease(note.note, time);
                }
              }, note.time + note.duration);
            }
          });
        });
        
        // Start transport at recording speed
        Tone.Transport.bpm.value = midiData.tempo || 120;
        Tone.Transport.start();
      }

      const renderFrame = () => {
        if (!isRecording || frameCount >= totalFrames) {
          mediaRecorder.stop();
          setIsRecording(false);
          setProgress(0);
          
          // Stop transport
          if (includeAudio) {
            Tone.Transport.stop();
            Tone.Transport.cancel();
          }
          return;
        }

        const currentTime = performance.now();
        const elapsedTime = currentTime - startTimeRef.current;
        const expectedFrame = Math.floor(elapsedTime / frameInterval);
        
        // Render all frames that should have been rendered by now
        while (frameCount <= expectedFrame && frameCount < totalFrames) {
          // Calculate current simulation time
          const simulationTime = (currentTimeRef.current / 1000); // Convert to seconds
          
          // Render the frame at this specific time
          onRenderFrame(virtualCanvas, simulationTime);
          
          frameCount++;
          currentTimeRef.current += timeStep;
        }
        
        // Update progress
        const newProgress = (frameCount / totalFrames) * 100;
        setProgress(newProgress);
        onProgress?.(newProgress);

        if (frameCount < totalFrames) {
          // Use requestAnimationFrame for better performance and to avoid throttling
          animationFrameRef.current = requestAnimationFrame(renderFrame);
        } else {
          mediaRecorder.stop();
          setIsRecording(false);
          setProgress(0);
          
          // Stop transport
          if (includeAudio) {
            Tone.Transport.stop();
            Tone.Transport.cancel();
          }
        }
      };

      // Start rendering
      renderFrame();

    } catch (error) {
      console.error('Failed to start virtual recording:', error);
    }
  }, [
    originalCanvasRef,
    onRenderFrame,
    duration,
    speedMultiplier,
    targetFrameRate,
    isSupported,
    includeAudio,
    midiData,
    originalAudioBuffer,
    isOriginalAudio,
    aspectRatio,
    targetWidth,
    zoom,
    calculateDimensions,
    initializeAudio,
    onRecordingStart,
    onRecordingStop,
    onProgress
  ]);

  const stopRecording = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setProgress(0);
    }
    
    // Stop transport and cleanup audio
    if (includeAudio) {
      Tone.Transport.stop();
      Tone.Transport.cancel();
    }
    if (audioSynthRef.current) {
      audioSynthRef.current.dispose();
    }
    audioStreamRef.current = null;
  }, [isRecording, includeAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioSynthRef.current) {
        audioSynthRef.current.dispose();
      }
    };
  }, []);

  if (!isSupported) {
    return (
      <div className="text-red-500 text-sm">
        Video recording is not supported in this browser
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hidden virtual canvas */}
      <canvas
        ref={virtualCanvasRef}
        style={{ 
          position: 'absolute', 
          left: '-9999px', 
          top: '-9999px',
          visibility: 'hidden'
        }}
      />
      
      {/* Controls */}
      <div className="flex gap-2">
        {!isRecording ? (
          <button
            onClick={startVirtualRecording}
            className="blend-btn"
            style={{
              fontSize: '0.9rem',
              padding: '0.5em 1em',
              backgroundColor: '#ff4444',
              color: 'white'
            }}
          >
            <Video size={16} /> Start Virtual Recording{includeAudio ? ' with Audio' : ''}
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="blend-btn"
            style={{
              fontSize: '0.9rem',
              padding: '0.5em 1em',
              backgroundColor: '#444444',
              color: 'white'
            }}
          >
            <Square size={16} /> Stop Recording
          </button>
        )}
      </div>

      {/* Progress bar */}
      {isRecording && (
        <div className="w-full">
          <div className="text-sm text-gray-600 mb-1">
            Recording Progress: {progress.toFixed(1)}%
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Recording info */}
      <div className="text-xs text-gray-500 space-y-1">
        <div>Duration: {duration}s</div>
        <div>Speed: {speedMultiplier}x</div>
        <div>Frame rate: {targetFrameRate}fps</div>
        <div>Aspect ratio: {aspectRatio}</div>
        <div>Target width: {targetWidth}px</div>
        <div>Zoom: {Math.round(zoom * 100)}%</div>
        <div>Estimated recording time: {(duration / speedMultiplier).toFixed(1)}s</div>
        {includeAudio && (
          <div className="text-green-600"><Music size={16} /> Audio will be included in recording</div>
        )}
      </div>
    </div>
  );
} 