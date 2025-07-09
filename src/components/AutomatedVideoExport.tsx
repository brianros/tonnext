'use client';

import React, { useRef, useState, useCallback } from 'react';
import { Square, Video } from 'lucide-react';
import * as Tone from 'tone';
import { useMidiContext } from '@/contexts/MidiContext';
import { useNotation } from '@/contexts/NotationContext';
import { useTonnext } from '@/hooks/useTonnext';
import { VirtualTonnetz } from './VirtualTonnetz';
import fixWebmDuration from 'webm-duration-fix';

interface AutomatedVideoExportProps {
  mode: 'note' | 'chord' | 'arpeggio';
  chordType: string;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

const FPS = 30;

const AutomatedVideoExport: React.FC<AutomatedVideoExportProps> = ({
  mode,
  chordType,
  canvasRef,
}) => {
  const { getMidiPlayerState, isMuted } = useMidiContext();
  const { getNoteName } = useNotation();
  const midiState = getMidiPlayerState();

  const [isExporting, setIsExporting] = useState(false);

  const virtualCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioSynthRef = useRef<Tone.PolySynth | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const virtualTonnetzRef = useRef<VirtualTonnetz | null>(null);

  const {
    initTonnext,
    handleMidiNoteStart,
    handleMidiNoteEnd,
    isInitialized,
  } = useTonnext({ mode, chordType });

  // Initialize virtual canvas
  React.useEffect(() => {
    if (virtualCanvasRef.current && !isInitialized) {
      initTonnext(virtualCanvasRef.current).catch(console.error);
    }
  }, [initTonnext, isInitialized]);

  const startAutomatedExport = useCallback(async () => {
    if (!canvasRef.current || !virtualCanvasRef.current || !midiState?.midiData) {
      alert('No MIDI file loaded. Please load a MIDI file before recording.');
      return;
    }

    setIsExporting(true);

    try {
      // 1. Set up device pixel ratio
      const originalCanvas = canvasRef.current;
      const virtualCanvas = virtualCanvasRef.current;
      const dpr = window.devicePixelRatio || 1;
      if (originalCanvas.width === 0 || originalCanvas.height === 0) {
        alert('Canvas is not ready (width or height is 0). Please make sure the visualization is visible and loaded before exporting.');
        setIsExporting(false);
        return;
      }
      virtualCanvas.width = originalCanvas.width * dpr;
      virtualCanvas.height = originalCanvas.height * dpr;
      virtualCanvas.style.width = originalCanvas.width + 'px';
      virtualCanvas.style.height = originalCanvas.height + 'px';

      // Log the canvas dimensions for debugging
      console.log('Exporting with canvas size:', originalCanvas.width, originalCanvas.height, 'DPR:', dpr);

      // 2. Wait for the next animation frame to ensure the browser updates the canvas
      await new Promise(requestAnimationFrame);

      // 3. Get the context and scale for DPR
      const ctx = virtualCanvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      virtualTonnetzRef.current = ctx ? new VirtualTonnetz(virtualCanvas, ctx, { mode, chordType, getNoteName }) : null;
      const synth = new Tone.PolySynth(Tone.Synth, Tone.Synth.getDefaults());
      const dest = Tone.context.createMediaStreamDestination();
      synth.connect(dest);
      audioSynthRef.current = synth;

      // Combine canvas and audio streams
      const videoStream = virtualCanvas.captureStream(FPS);
      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      // Set up MediaRecorder
      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }
      if (!selectedMimeType) throw new Error('No supported video MIME type found');
      const mediaRecorder = new MediaRecorder(combinedStream, { mimeType: selectedMimeType });
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        if (chunks.length > 0) {
          // Use webm-duration-fix to correct the duration metadata
          const duration = midiState.duration;
          const fixedBlob = await fixWebmDuration(new Blob(chunks, { type: selectedMimeType }), duration * 1000);
          const url = URL.createObjectURL(fixedBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `tonnext-export-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
        }
        if (audioSynthRef.current) {
          audioSynthRef.current.dispose();
          audioSynthRef.current = null;
        }
        setIsExporting(false);
      };

      // Schedule MIDI notes for audio
      Tone.Transport.cancel();
      Tone.Transport.bpm.value = midiState.midiData.tempo || 120;
      midiState.midiData.tracks.forEach((track: { notes: Array<{ note: string; time: number; duration: number; velocity: number; midi: number }> }) => {
        track.notes.forEach((note: { note: string; time: number; duration: number; velocity: number; midi: number }) => {
          Tone.Transport.schedule((time) => {
            if (!isMuted && audioSynthRef.current) {
              audioSynthRef.current.triggerAttack(note.note, time, note.velocity);
            }
            handleMidiNoteStart(note);
          }, note.time);
          Tone.Transport.schedule((time) => {
            if (!isMuted && audioSynthRef.current) {
              audioSynthRef.current.triggerRelease(note.note, time);
            }
            handleMidiNoteEnd(note);
          }, note.time + note.duration);
        });
      });

      // Start recording and rendering
      mediaRecorder.start();
      Tone.Transport.start();
      const duration = midiState.duration;
      const totalFrames = Math.ceil(duration * FPS);
      let frameCount = 0;
      const frameInterval = 1000 / FPS;
      
      const startTime = performance.now();
      
      const renderFrame = () => {
        const currentTime = performance.now();
        const elapsedTime = currentTime - startTime;
        const expectedFrame = Math.floor(elapsedTime / frameInterval);
        
        // Render all frames that should have been rendered by now
        while (frameCount <= expectedFrame && frameCount < totalFrames) {
          const currentTime = (frameCount / FPS);
          if (virtualTonnetzRef.current) {
            virtualTonnetzRef.current.update(currentTime, midiState.midiData);
          }
          frameCount++;
        }
        
        if (frameCount >= totalFrames) {
          // Force a final frame render with requestAnimationFrame before stopping
          const finalTime = duration;
          if (virtualTonnetzRef.current) {
            virtualTonnetzRef.current.update(finalTime, midiState.midiData);
          }
          requestAnimationFrame(() => {
            setTimeout(() => {
              mediaRecorder.stop();
              Tone.Transport.stop();
              Tone.Transport.cancel();
            }, 200);
          });
          return;
        }
        
        // Use requestAnimationFrame for better performance and to avoid throttling
        animationFrameRef.current = requestAnimationFrame(renderFrame);
      };
      renderFrame();
    } catch (error) {
      alert(`Export failed: ${error}`);
      setIsExporting(false);
      if (audioSynthRef.current) {
        audioSynthRef.current.dispose();
        audioSynthRef.current = null;
      }
    }
  }, [canvasRef, midiState, handleMidiNoteStart, handleMidiNoteEnd, mode, chordType, isMuted, getNoteName]);

  React.useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioSynthRef.current) audioSynthRef.current.dispose();
    };
  }, []);

  if (!midiState?.midiData) {
    return null;
  }

  return (
    <>
      {/* Hidden virtual canvas */}
      <canvas
        ref={virtualCanvasRef}
        className="automated-video-export__canvas"
      />
      
      {/* Simple Export Video Button */}
      <button
        onClick={startAutomatedExport}
        disabled={isExporting}
        className="blend-btn midi-theme-btn automated-video-export__btn"
        title={isExporting ? 'Exporting...' : 'Export video with audio'}
        style={{
          background: isExporting ? '#666' : '#2196F3',
          opacity: isExporting ? 0.7 : 1,
          cursor: isExporting ? 'not-allowed' : 'pointer',
        }}
      >
        {isExporting ? <><Square size={16} /> Exporting...</> : <><Video size={16} /> Export Video</>}
      </button>
    </>
  );
};

export default AutomatedVideoExport; 