'use client';

import React, { useRef, useState } from 'react';
import VirtualCanvasRecorder from './VirtualCanvasRecorder';
import { useTonnext } from '@/hooks/useTonnext';

interface VirtualRecordingExampleProps {
  mode: 'note' | 'chord' | 'arpeggio';
  chordType: string;
}

export default function VirtualRecordingExample({ 
  mode, 
  chordType 
}: VirtualRecordingExampleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [recordingSettings, setRecordingSettings] = useState({
    duration: 30, // 30 seconds
    speedMultiplier: 2, // 2x speed
    targetFrameRate: 30
  });

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

  // Initialize the canvas
  React.useEffect(() => {
    if (canvasRef.current && !isInitialized) {
      initTonnext(canvasRef.current);
    }
  }, [initTonnext, isInitialized]);

  // Callback to render a frame at a specific time
  const handleRenderFrame = (canvas: HTMLCanvasElement, time: number) => {
    // Fallback: just render the current state
    const ctx = canvas.getContext('2d');
    if (ctx && canvasRef.current) {
      // Copy the current canvas state to the virtual canvas
      ctx.drawImage(canvasRef.current, 0, 0);
    }
  };

  const handleRecordingStart = () => {
    console.log('Virtual recording started');
  };

  const handleRecordingStop = (blob: Blob) => {
    console.log('Virtual recording completed', blob);
  };

  const handleProgress = (progress: number) => {
    console.log('Recording progress:', progress);
  };

  return (
    <div className="space-y-4">
      {/* Original Canvas */}
      <div className="relative w-full h-full">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-default"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            handleCanvasClick(x, y);
          }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            handleMouseMove(x, y);
          }}
          onMouseLeave={handleMouseLeave}
          tabIndex={0}
          style={{ touchAction: 'none', pointerEvents: 'auto' }}
        />
        <div id="note-labels" className="absolute inset-0 pointer-events-none" />
        <div id="triad-labels" className="absolute inset-0 pointer-events-none" />
      </div>

      {/* Recording Controls */}
      <div className="p-4 border rounded-lg bg-gray-50">
        <h3 className="text-lg font-semibold mb-4">Virtual Recording Settings</h3>
        
        {/* Recording Settings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Duration (seconds)
            </label>
            <input
              type="number"
              min="1"
              max="300"
              value={recordingSettings.duration}
              onChange={(e) => setRecordingSettings(prev => ({
                ...prev,
                duration: parseInt(e.target.value) || 30
              }))}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              Speed Multiplier
            </label>
            <input
              type="number"
              min="0.1"
              max="10"
              step="0.1"
              value={recordingSettings.speedMultiplier}
              onChange={(e) => setRecordingSettings(prev => ({
                ...prev,
                speedMultiplier: parseFloat(e.target.value) || 1
              }))}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              Frame Rate (fps)
            </label>
            <input
              type="number"
              min="15"
              max="60"
              value={recordingSettings.targetFrameRate}
              onChange={(e) => setRecordingSettings(prev => ({
                ...prev,
                targetFrameRate: parseInt(e.target.value) || 30
              }))}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        {/* Virtual Recorder */}
        <VirtualCanvasRecorder
          originalCanvasRef={canvasRef}
          onRenderFrame={handleRenderFrame}
          duration={recordingSettings.duration}
          speedMultiplier={recordingSettings.speedMultiplier}
          targetFrameRate={recordingSettings.targetFrameRate}
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
          onProgress={handleProgress}
        />
      </div>

      {/* Info */}
      <div className="text-sm text-gray-600">
        <p><strong>How it works:</strong></p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Creates a hidden virtual canvas with the same dimensions</li>
          <li>Renders frames at accelerated speed (faster than real-time)</li>
          <li>Records the virtual canvas to create a time-lapse video</li>
          <li>Automatically downloads the video when complete</li>
        </ul>
        <p className="mt-2">
          <strong>Example:</strong> A 30-second piece recorded at 2x speed will create a 15-second video showing the entire performance.
        </p>
      </div>
    </div>
  );
} 