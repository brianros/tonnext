'use client';

import { useEffect, useRef } from 'react';
import { useTonnext } from '@/hooks/useTonnext';
import { useMidiContext } from '@/contexts/MidiContext';

interface TonnextCanvasProps {
  mode: 'note' | 'chord' | 'arpeggio';
  chordType: string;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export default function TonnextCanvas({ 
  mode, 
  chordType,
  canvasRef: externalCanvasRef
}: TonnextCanvasProps) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  const { setCanvasCallbacks, getMidiPlayerState } = useMidiContext();
  const { 
    initTonnext, 
    handleCanvasClick, 
    handleMouseMove, 
    handleMouseLeave,
    handleWheel,
    handleMidiNoteStart,
    handleMidiNoteEnd,
    handleMidiChordStart,
    handleMidiChordEnd,
    isInitialized 
  } = useTonnext({ mode, chordType });

  useEffect(() => {
    if (canvasRef.current && !isInitialized) {
      initTonnext(canvasRef.current).catch(console.error);
    }
    // Attach wheel event with passive: false
    const canvas = canvasRef.current;
    if (canvas) {
      const wheelHandler = (e: WheelEvent) => {
        handleWheel(e);
      };
      canvas.addEventListener('wheel', wheelHandler, { passive: false });
      return () => canvas.removeEventListener('wheel', wheelHandler);
    }
  }, [initTonnext, isInitialized, handleWheel, canvasRef]);

  // Register canvas callbacks with the context
  useEffect(() => {
    setCanvasCallbacks({
      handleMidiNoteStart,
      handleMidiNoteEnd,
      handleMidiChordStart,
      handleMidiChordEnd
    });
  }, [setCanvasCallbacks, handleMidiNoteStart, handleMidiNoteEnd, handleMidiChordStart, handleMidiChordEnd]);

  // Listen for tour-demo-chord event and show a C major chord
  useEffect(() => {
    function handleTourDemoChord(e?: CustomEvent) {
      let notes = [
        { midi: 60 }, // C4
        { midi: 64 }, // E4
        { midi: 67 }, // G4
      ];
      if (e && e.detail && e.detail.chord === 'maj7') {
        notes = [
          { midi: 60 }, // C4
          { midi: 64 }, // E4
          { midi: 67 }, // G4
          { midi: 71 }, // B4
        ];
      }
      handleMidiChordStart({ notes });
      setTimeout(() => {
        handleMidiChordEnd();
      }, 700);
    }
    // Use addEventListener with type assertion for CustomEvent
    const handler = (e: Event) => handleTourDemoChord(e as CustomEvent);
    window.addEventListener('tour-demo-chord', handler);
    return () => window.removeEventListener('tour-demo-chord', handler);
  }, [handleMidiChordStart, handleMidiChordEnd]);



  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    // Check if MIDI is playing and disable clicks if it is
    const midiState = getMidiPlayerState();
    if (midiState?.isPlaying) {
      return; // Disable clicks while MIDI is playing
    }
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    handleCanvasClick(x, y);
  };

  const handleMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    handleMouseMove(x, y);
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-default"
        onClick={handleClick}
        onMouseMove={handleMove}
        onMouseLeave={handleMouseLeave}
        tabIndex={0}
        style={{ touchAction: 'none', pointerEvents: 'auto' }}
      />
      <div id="note-labels" className="absolute inset-0 pointer-events-none" />
      <div id="triad-labels" className="absolute inset-0 pointer-events-none" />
    </div>
  );
} 