'use client';

import React, { useRef, useState } from 'react';
import VirtualCanvasRecorder from './VirtualCanvasRecorder';
import { useTonnext } from '@/hooks/useTonnext';
import { useMidiContext } from '@/contexts/MidiContext';
import { VirtualTonnetz } from './VirtualTonnetz';
import ExportVideoModal from './ExportVideoModal';
import { Music, Video } from 'lucide-react';

interface VirtualRecordingExampleProps {
  mode: 'note' | 'chord' | 'arpeggio';
  chordType: string;
}

export default function VirtualRecordingExample({ 
  mode, 
  chordType 
}: VirtualRecordingExampleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const virtualTonnetzRef = useRef<VirtualTonnetz | null>(null);
  const { getMidiPlayerState } = useMidiContext();
  const midiState = getMidiPlayerState();
  
  const [recordingSettings, setRecordingSettings] = useState({
    duration: 30, // Will be updated from MIDI
    speedMultiplier: 1, // Fixed at 1x
    targetFrameRate: 30, // Fixed at 30fps
    includeAudio: false,
    aspectRatio: 'original',
    targetWidth: 1920, // Fixed at 1920px
    zoom: 1.0
  });

  const [isModalOpen, setIsModalOpen] = useState(false);

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
      initTonnext(canvasRef.current).catch(console.error);
    }
  }, [initTonnext, isInitialized]);

  // Callback to render a frame at a specific time
  const handleRenderFrame = (canvas: HTMLCanvasElement, time: number) => {
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
    if (virtualTonnetzRef.current && midiState?.midiData) {
      virtualTonnetzRef.current.update(time, midiState.midiData);
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

  const [isRecording, setIsRecording] = useState(false);

  const handleExportSettings = (settings: any) => {
    setRecordingSettings(settings);
    setIsRecording(true); // This will trigger the recording
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
            <Music className="text-green-600" size={16} />
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

      {/* Video Export */}
      <div className="p-4 border rounded-lg bg-gray-50">
        <h3 className="text-lg font-semibold mb-4">Video Export</h3>
        
        <div className="flex gap-4 items-center">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Video size={16} />
            <span>Export Video</span>
          </button>
          
          <div className="text-sm text-gray-600">
            {midiState?.midiData ? (
              <span>✅ MIDI file loaded - audio export available</span>
            ) : (
              <span>⚠️ Load a MIDI file to enable audio export</span>
            )}
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          Click to open export settings with preview, aspect ratio options, and zoom controls.
        </div>
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
            <li className="text-green-600"><Music size={16} /> MIDI audio will be synthesized and included in the video</li>
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

      {/* VirtualCanvasRecorder - only shown when recording */}
      {isRecording && (
        <VirtualCanvasRecorder
          originalCanvasRef={canvasRef}
          onRenderFrame={handleRenderFrame}
          duration={recordingSettings.duration}
          speedMultiplier={recordingSettings.speedMultiplier}
          targetFrameRate={recordingSettings.targetFrameRate}
          includeAudio={recordingSettings.includeAudio}
          aspectRatio={recordingSettings.aspectRatio}
          targetWidth={recordingSettings.targetWidth}
          zoom={recordingSettings.zoom}
          midiData={midiState?.midiData}
          onRecordingStart={handleRecordingStart}
          onRecordingStop={(blob) => {
            handleRecordingStop(blob);
            setIsRecording(false);
          }}
          onProgress={handleProgress}
        />
      )}

      {/* Export Video Modal */}
      <ExportVideoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onExport={handleExportSettings}
        originalCanvasRef={canvasRef}
        midiData={midiState?.midiData}
        mode={mode}
        chordType={chordType}
      />
    </div>
  );
} 