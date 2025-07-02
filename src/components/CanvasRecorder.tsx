'use client';

import React, { useRef, useState, useCallback } from 'react';
import { Square, Video } from 'lucide-react';
import fixWebmDuration from 'webm-duration-fix';

interface CanvasRecorderProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onRecordingStart?: () => void;
  onRecordingStop?: (blob: Blob) => void;
}

export default function CanvasRecorder({ 
  canvasRef, 
  onRecordingStart, 
  onRecordingStop 
}: CanvasRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Check if MediaRecorder is supported
  React.useEffect(() => {
    setIsSupported(!!window.MediaRecorder);
  }, []);

  const startRecording = useCallback(() => {
    if (!canvasRef.current || !isSupported) return;

    const canvas = canvasRef.current;
    const stream = canvas.captureStream(30); // 30 FPS

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

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Use webm-duration-fix to correct the duration metadata
        const fixedBlob = await fixWebmDuration(new Blob(chunksRef.current, { type: selectedMimeType }), 0);
        onRecordingStop?.(fixedBlob);
        
        // Auto-download the video
        const url = URL.createObjectURL(fixedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `canvas-recording-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      onRecordingStart?.();

    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, [canvasRef, isSupported, onRecordingStart, onRecordingStop]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  if (!isSupported) {
    return (
      <div className="text-red-500 text-sm">
        Video recording is not supported in this browser
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {!isRecording ? (
        <button
          onClick={startRecording}
          className="blend-btn"
          style={{
            fontSize: '0.9rem',
            padding: '0.5em 1em',
            backgroundColor: '#ff4444',
            color: 'white'
          }}
        >
          <Video size={16} /> Start Recording
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
  );
} 