'use client';

import { useEffect, useRef } from 'react';
import { useTonnext } from '@/hooks/useTonnetz';

interface TonnextCanvasProps {
  mode: 'note' | 'chord' | 'arpeggio';
  chordType: string;
}

export default function TonnextCanvas({ mode, chordType }: TonnextCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { 
    initTonnext, 
    handleCanvasClick, 
    handleMouseMove, 
    handleMouseLeave,
    handleWheel,
    isInitialized 
  } = useTonnext({ mode, chordType });

  useEffect(() => {
    if (canvasRef.current && !isInitialized) {
      initTonnext(canvasRef.current);
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
  }, [initTonnext, isInitialized]);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
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