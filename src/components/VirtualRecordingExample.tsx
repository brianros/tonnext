'use client';

import React, { useRef, useState } from 'react';
import VirtualCanvasRecorder from './VirtualCanvasRecorder';
import { useTonnext } from '@/hooks/useTonnext';
import { useMidiContext } from '@/contexts/MidiContext';

interface VirtualRecordingExampleProps {
  mode: 'note' | 'chord' | 'arpeggio';
  chordType: string;
}

export default function VirtualRecordingExample({ 
  mode, 
  chordType 
}: VirtualRecordingExampleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { getMidiPlayerState } = useMidiContext();
  const midiState = getMidiPlayerState();
  
  const [recordingSettings, setRecordingSettings] = useState({
    duration: 30, // 30 seconds
    speedMultiplier: 2, // 2x speed
    targetFrameRate: 30,
    includeAudio: false
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

  // Auto-set duration from MIDI if available
  React.useEffect(() => {
    if (midiState?.midiData && midiState.duration > 0) {
      setRecordingSettings(prev => ({
        ...prev,
        duration: midiState.duration
      }));
    }
  }, [midiState?.midiData, midiState?.duration]);

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

      {/* MIDI File Status */}
      {midiState?.midiData && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-green-600">🎵</span>
            <span className="text-sm font-medium text-green-800">
              MIDI File Loaded: {midiState.fileName}
            </span>
          </div>
          <div className="text-xs text-green-600 mt-1">
            Duration: {midiState.duration.toFixed(1)}s | 
            Tempo: {midiState.midiData.tempo} BPM
          </div>
        </div>
      )}

      {/* Recording Controls */}
      <div className="p-4 border rounded-lg bg-gray-50">
        <h3 className="text-lg font-semibold mb-4">Virtual Recording Settings</h3>
        
        {/* Recording Settings */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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

          <div>
            <label className="block text-sm font-medium mb-1">
              Include Audio
            </label>
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                id="include-audio"
                checked={recordingSettings.includeAudio}
                onChange={(e) => setRecordingSettings(prev => ({
                  ...prev,
                  includeAudio: e.target.checked
                }))}
                disabled={!midiState?.midiData}
                className="mr-2"
              />
              <label htmlFor="include-audio" className={`text-sm ${!midiState?.midiData ? 'text-gray-400' : ''}`}>
                {midiState?.midiData ? 'Add MIDI audio to video' : 'Load MIDI file first'}
              </label>
            </div>
          </div>
        </div>

        {/* Virtual Recorder */}
        <VirtualCanvasRecorder
          originalCanvasRef={canvasRef}
          onRenderFrame={handleRenderFrame}
          duration={recordingSettings.duration}
          speedMultiplier={recordingSettings.speedMultiplier}
          targetFrameRate={recordingSettings.targetFrameRate}
          includeAudio={recordingSettings.includeAudio}
          midiData={midiState?.midiData}
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
          {recordingSettings.includeAudio && midiState?.midiData && (
            <li className="text-green-600">🎵 MIDI audio will be synthesized and included in the video</li>
          )}
        </ul>
        <p className="mt-2">
          <strong>Example:</strong> A 30-second piece recorded at 2x speed will create a 15-second video showing the entire performance.
        </p>
        {!midiState?.midiData && recordingSettings.includeAudio && (
          <p className="mt-2 text-orange-600">
            <strong>Note:</strong> To include audio, first load a MIDI file using the MIDI player controls.
          </p>
        )}
      </div>
    </div>
  );
} 