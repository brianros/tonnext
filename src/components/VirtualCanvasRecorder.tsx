'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';

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
  onRecordingStart,
  onRecordingStop,
  onProgress
}: VirtualCanvasRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [progress, setProgress] = useState(0);
  const virtualCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const animationFrameRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const startTimeRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0);

  // Check if MediaRecorder is supported
  useEffect(() => {
    setIsSupported(!!window.MediaRecorder);
  }, []);

  const startVirtualRecording = useCallback(async () => {
    if (!originalCanvasRef.current || !virtualCanvasRef.current || !isSupported) return;

    const originalCanvas = originalCanvasRef.current;
    const virtualCanvas = virtualCanvasRef.current;
    
    // Set virtual canvas to same dimensions as original
    virtualCanvas.width = originalCanvas.width;
    virtualCanvas.height = originalCanvas.height;
    
    // Get the virtual canvas context
    const virtualCtx = virtualCanvas.getContext('2d');
    if (!virtualCtx) return;

    // Calculate timing
    const frameInterval = 1000 / targetFrameRate; // milliseconds per frame
    const totalFrames = Math.ceil((duration * 1000) / frameInterval);
    const timeStep = (duration * 1000) / totalFrames; // milliseconds per frame in simulation time
    
    console.log(`Recording ${totalFrames} frames at ${targetFrameRate}fps, ${speedMultiplier}x speed`);

    // Create stream from virtual canvas
    const stream = virtualCanvas.captureStream(targetFrameRate);

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
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType
      });

      const chunks: Blob[] = [];
      let frameCount = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: selectedMimeType });
        onRecordingStop?.(blob);
        
        // Auto-download the video
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `virtual-recording-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      onRecordingStart?.();

      // Start the virtual rendering loop
      startTimeRef.current = performance.now();
      currentTimeRef.current = 0;

      const renderFrame = () => {
        if (!isRecording || frameCount >= totalFrames) {
          mediaRecorder.stop();
          setIsRecording(false);
          setProgress(0);
          return;
        }

        // Calculate current simulation time
        const simulationTime = (currentTimeRef.current / 1000); // Convert to seconds
        
        // Render the frame at this specific time
        onRenderFrame(virtualCanvas, simulationTime);
        
        // Update progress
        const newProgress = (frameCount / totalFrames) * 100;
        setProgress(newProgress);
        onProgress?.(newProgress);
        
        frameCount++;
        currentTimeRef.current += timeStep;

        // Schedule next frame based on speed multiplier
        const nextFrameDelay = frameInterval / speedMultiplier;
        animationFrameRef.current = setTimeout(renderFrame, nextFrameDelay);
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
    onRecordingStart,
    onRecordingStop,
    onProgress
  ]);

  const stopRecording = useCallback(() => {
    if (animationFrameRef.current) {
      clearTimeout(animationFrameRef.current);
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setProgress(0);
    }
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        clearTimeout(animationFrameRef.current);
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
            🎬 Start Virtual Recording
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
            ⏹️ Stop Recording
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
      <div className="text-xs text-gray-500">
        <div>Duration: {duration}s</div>
        <div>Speed: {speedMultiplier}x</div>
        <div>Frame Rate: {targetFrameRate}fps</div>
        <div>Estimated recording time: {(duration / speedMultiplier).toFixed(1)}s</div>
      </div>
    </div>
  );
} 