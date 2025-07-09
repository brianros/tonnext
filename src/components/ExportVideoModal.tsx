'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VirtualTonnetz } from './VirtualTonnetz';
import type { MidiData } from '@/hooks/useMidiPlayer';
import { Monitor, Smartphone, Tv, Square, RectangleHorizontal } from 'lucide-react';
import { useMidiContext } from '@/contexts/MidiContext';
import { useNotation } from '@/contexts/NotationContext';

interface ExportVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (settings: ExportSettings) => void;
  originalCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  midiData?: MidiData | null;
  mode: 'note' | 'chord' | 'arpeggio';
  chordType: string;
  fileName?: string;
}

interface ExportSettings {
  duration: number;
  startTime: number;
  endTime: number;
  speedMultiplier: number;
  targetFrameRate: number;
  includeAudio: boolean;
  aspectRatio: string;
  targetWidth: number;
  zoom: number;
  exportFileName: string;
}

const ASPECT_RATIOS = [
  { value: '16:9', label: 'Landscape (16:9)', icon: <Monitor size={20} /> },
  { value: '9:16', label: 'Portrait (9:16)', icon: <Smartphone size={20} /> },
  { value: '4:3', label: 'Classic (4:3)', icon: <Tv size={20} /> },
  { value: '1:1', label: 'Square (1:1)', icon: <Square size={20} /> },
  { value: '4:5', label: 'Social (4:5)', icon: <RectangleHorizontal size={20} /> },
];

const QUALITY_PRESETS: Record<string, { label: string; width: number; height: number; }[]> = {
  '16:9': [
    { label: 'Low', width: 854, height: 480 },
    { label: 'Medium', width: 1280, height: 720 },
    { label: 'High', width: 1920, height: 1080 },
  ],
  '9:16': [
    { label: 'Low', width: 480, height: 854 },
    { label: 'Medium', width: 720, height: 1280 },
    { label: 'High', width: 1080, height: 1920 },
  ],
  '4:3': [
    { label: 'Low', width: 640, height: 480 },
    { label: 'Medium', width: 960, height: 720 },
    { label: 'High', width: 1440, height: 1080 },
  ],
  '1:1': [
    { label: 'Low', width: 480, height: 480 },
    { label: 'Medium', width: 720, height: 720 },
    { label: 'High', width: 1080, height: 1080 },
  ],
  '4:5': [
    { label: 'Low', width: 480, height: 600 },
    { label: 'Medium', width: 720, height: 900 },
    { label: 'High', width: 1080, height: 1350 },
  ],
};

// Dual range slider component
interface DualRangeSliderProps {
  min: number;
  max: number;
  step: number;
  startValue: number;
  endValue: number;
  onStartChange: (value: number) => void;
  onEndChange: (value: number) => void;
  style?: React.CSSProperties;
}

function DualRangeSlider({ 
  min, 
  max, 
  step, 
  startValue, 
  endValue, 
  onStartChange, 
  onEndChange, 
  style 
}: DualRangeSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);

  const handleMouseDown = (e: React.MouseEvent, isStart: boolean) => {
    e.preventDefault();
    if (isStart) {
      setIsDraggingStart(true);
    } else {
      setIsDraggingEnd(true);
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current || (!isDraggingStart && !isDraggingEnd)) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const value = min + (max - min) * percentage;
    const roundedValue = Math.round(value / step) * step;

    if (isDraggingStart) {
      const newStartValue = Math.min(roundedValue, endValue - step);
      onStartChange(newStartValue);
    } else if (isDraggingEnd) {
      const newEndValue = Math.max(roundedValue, startValue + step);
      onEndChange(newEndValue);
    }
  }, [isDraggingStart, isDraggingEnd, min, max, step, startValue, endValue, onStartChange, onEndChange]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingStart(false);
    setIsDraggingEnd(false);
  }, []);

  useEffect(() => {
    if (isDraggingStart || isDraggingEnd) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingStart, isDraggingEnd, handleMouseMove, handleMouseUp]);

  const startPercentage = ((startValue - min) / (max - min)) * 100;
  const endPercentage = ((endValue - min) / (max - min)) * 100;

  return (
    <div 
      ref={containerRef}
      className="dual-range-slider"
      style={style}
    >
      {/* Track background */}
      <div className="dual-range-slider__track" />
      {/* Selected range */}
      <div
        className="dual-range-slider__selected"
        style={{ left: `${startPercentage}%`, right: `${100 - endPercentage}%` }}
      />
      {/* Start thumb */}
      <div
        className="dual-range-slider__thumb"
        style={{ left: `${startPercentage}%` }}
        onMouseDown={(e) => handleMouseDown(e, true)}
      />
      {/* End thumb */}
      <div
        className="dual-range-slider__thumb"
        style={{ left: `${endPercentage}%` }}
        onMouseDown={(e) => handleMouseDown(e, false)}
      />
    </div>
  );
}

export default function ExportVideoModal({
  isOpen,
  onClose,
  onExport,
  originalCanvasRef,
  midiData,
  mode,
  chordType,
  fileName
}: ExportVideoModalProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const virtualTonnetzRef = useRef<VirtualTonnetz | null>(null);
  const { getMidiPlayerState } = useMidiContext();
  const { getNoteName } = useNotation();
  const playerState = getMidiPlayerState();
  
  const [settings, setSettings] = useState<ExportSettings>({
    duration: midiData?.duration || 30,
    startTime: 0,
    endTime: midiData?.duration || 30,
    speedMultiplier: 1,
    targetFrameRate: 30,
    includeAudio: true,
    aspectRatio: '16:9',
    targetWidth: 1920,
    zoom: 1.0,
    exportFileName: fileName || 'virtual-recording'
  });

  const [quality, setQuality] = useState('High');

  // Calculate preview dimensions based on aspect ratio
  const calculatePreviewDimensions = useCallback((aspectRatio: string) => {
    const maxPreviewWidth = 450;
    const maxPreviewHeight = 350;
    
    let width: number;
    let height: number;
    
    switch (aspectRatio) {
      case '16:9':
        width = maxPreviewWidth;
        height = Math.round(maxPreviewWidth * (9 / 16));
        break;
      case '9:16':
        width = Math.round(maxPreviewHeight * (9 / 16));
        height = maxPreviewHeight;
        break;
      case '4:3':
        width = maxPreviewWidth;
        height = Math.round(maxPreviewWidth * (3 / 4));
        break;
      case '1:1':
        width = Math.min(maxPreviewWidth, maxPreviewHeight);
        height = width;
        break;
      case '4:5':
        width = maxPreviewWidth;
        height = Math.round(maxPreviewWidth * (5 / 4));
        break;
      default:
        width = maxPreviewWidth;
        height = maxPreviewHeight;
        break;
    }
    
    // Don't apply zoom to dimensions - zoom affects density instead
    return {
      width,
      height
    };
  }, []);

  // Update preview canvas
  const updatePreview = useCallback(() => {
    if (!previewCanvasRef.current || !originalCanvasRef.current) return;
    
    const previewCanvas = previewCanvasRef.current;
    const { width, height } = calculatePreviewDimensions(settings.aspectRatio);
    
    previewCanvas.width = width;
    previewCanvas.height = height;
    
    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;
    // Always clear and fill with Tonnetz background color
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.fillStyle = '#D4D7CB';
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    
    // Calculate density based on zoom, using current canvas density as base
    const baseDensity = (window as unknown as { __currentCanvasDensity: number })?.__currentCanvasDensity || 20;
    const density = Math.round(baseDensity / settings.zoom);
    
    // Always create a new VirtualTonnetz instance after resizing
    virtualTonnetzRef.current = new VirtualTonnetz(previewCanvas, ctx, { mode, chordType, density, getNoteName });
    
    // Render a sample frame (at 0 seconds or current time)
    if (virtualTonnetzRef.current && midiData) {
      virtualTonnetzRef.current.update(0, midiData);
    } else if (virtualTonnetzRef.current) {
      // Fallback: show some active notes
      const sampleNotes = [0, 4, 7]; // C major chord
      virtualTonnetzRef.current.setActiveNotes(sampleNotes);
    }
  }, [settings.aspectRatio, settings.zoom, calculatePreviewDimensions, originalCanvasRef, mode, chordType, midiData]);

  // Update settings when MIDI data changes
  useEffect(() => {
    if (midiData?.duration) {
      setSettings(prev => ({ 
        ...prev, 
        duration: midiData.duration,
        endTime: midiData.duration 
      }));
    }
  }, [midiData?.duration]);

  // Update preview when settings change
  useEffect(() => {
    if (isOpen) {
      updatePreview();
    }
  }, [isOpen, updatePreview]);

  // Ensure aspect ratio is always a valid key for QUALITY_PRESETS
  const validAspectRatios = Object.keys(QUALITY_PRESETS);
  const aspectKey = validAspectRatios.includes(settings.aspectRatio) ? settings.aspectRatio : '16:9';

  // Update targetWidth and aspect ratio height when quality or aspect ratio changes
  useEffect(() => {
    const preset = QUALITY_PRESETS[aspectKey]?.find(q => q.label === quality) || QUALITY_PRESETS['16:9'][2];
    setSettings(prev => ({ ...prev, targetWidth: preset.width }));
  }, [quality, aspectKey]);

  useEffect(() => {
    setSettings(prev => ({ ...prev, exportFileName: fileName || 'virtual-recording' }));
  }, [fileName]);

  const handleExport = () => {
    onExport(settings);
    onClose();
  };

  if (!isOpen) return null;

  const zoomSlider = (
    <input
      type="range"
      min="0.5"
      max="2.0"
      step="0.1"
      value={settings.zoom}
      onChange={(e) => setSettings(prev => ({ ...prev, zoom: parseFloat(e.target.value) }))}
      className="export-modal-zoom-slider"
      aria-label="Zoom Slider"
    />
  );

  const timeRangeSlider = (
    <div className="export-modal__time-range-box">
      <div className="export-modal__time-range-info">
        <span>Start: {settings.startTime.toFixed(1)}s</span>
        <span>End: {settings.endTime.toFixed(1)}s</span>
      </div>
      <DualRangeSlider
        min={0}
        max={settings.duration}
        step={0.1}
        startValue={settings.startTime}
        endValue={settings.endTime}
        onStartChange={(value) => setSettings(prev => ({ 
          ...prev, 
          startTime: value,
          endTime: Math.max(value + 1, prev.endTime)
        }))}
        onEndChange={(value) => setSettings(prev => ({ 
          ...prev, 
          endTime: value,
          startTime: Math.min(value - 1, prev.startTime)
        }))}
        aria-label="Time Range Slider"
      />
    </div>
  );

  return (
    <div className="export-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="export-modal-outer">
        <div className="export-modal" style={{ borderRadius: 12, maxWidth: 600, width: '95vw', paddingTop: 32, paddingBottom: 0, padding: 0, margin: 0 }}>
          <button
            onClick={onClose}
            className="export-modal-btn export-modal-close"
            title="Close"
            aria-label="Close Export Modal"
          >
            ×
          </button>
          <div className="export-modal__content">
            <div className="export-modal__preview-col">
              <div className="export-modal__preview-row">
                <div className="export-modal__preview-stack">
                  <div className="export-modal-preview-area">
                    <canvas
                      ref={previewCanvasRef}
                      className="export-modal-preview-canvas"
                      aria-label="Preview Canvas"
                    />
                  </div>
                </div>
                <div className="export-modal__preview-stack">
                  <div className="export-modal__right-group">
                    <div className="export-modal-aspect">
                      <div className="export-modal-aspect-list">
                        {ASPECT_RATIOS.map((ratio) => (
                          <button
                            key={ratio.value}
                            onClick={() => setSettings(prev => ({ ...prev, aspectRatio: ratio.value }))}
                            className={`export-modal-aspect-btn${settings.aspectRatio === ratio.value ? ' selected' : ''}`}
                            aria-label={`Aspect Ratio: ${ratio.label}`}
                          >
                            <div className="export-modal-aspect-icon">{ratio.icon}</div>
                            <div className="export-modal-aspect-label">{ratio.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="export-modal-quality-group">
                      {QUALITY_PRESETS[aspectKey]?.map((q: { label: string; width: number; height: number; }) => (
                        <button
                          key={q.label}
                          onClick={() => setQuality(q.label)}
                          className={`export-modal-aspect-btn${quality === q.label ? ' selected' : ''}`}
                          aria-label={`Quality: ${q.label}`}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Replace the controls section with a two-column layout for sliders */}
          <div className="export-modal-controls" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'center', marginTop: 12, marginBottom: 24 }}>
            <div style={{ width: 240 }}>
              <label className="export-modal-label">Zoom</label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={settings.zoom}
                onChange={(e) => setSettings(prev => ({ ...prev, zoom: parseFloat(e.target.value) }))}
                className="export-modal-zoom-slider"
                style={{ width: '100%' }}
                aria-label="Zoom Slider"
              />
            </div>
            <div style={{ width: 240, marginTop: 24 }}>
              <label className="export-modal-label" style={{ marginTop: -8 }}>{'Time Range'}</label>
              <DualRangeSlider
                min={0}
                max={settings.duration}
                step={0.1}
                startValue={settings.startTime}
                endValue={settings.endTime}
                onStartChange={(value) => setSettings(prev => ({ 
                  ...prev, 
                  startTime: value,
                  endTime: Math.max(value + 1, prev.endTime)
                }))}
                onEndChange={(value) => setSettings(prev => ({ 
                  ...prev, 
                  endTime: value,
                  startTime: Math.min(value - 1, prev.startTime)
                }))}
                style={{ width: '100%' }}
                aria-label="Time Range Slider"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#bdbdbd', marginTop: 2 }}>
                <span>Start: {settings.startTime.toFixed(1)}s</span>
                <span>End: {settings.endTime.toFixed(1)}s</span>
              </div>
            </div>
          </div>
          <div className="export-modal-footer">
            <button
              onClick={handleExport}
              className="blend-btn export-modal__export-btn"
              aria-label="Export Video"
            >
              Export Video
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 