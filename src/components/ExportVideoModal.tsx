'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VirtualTonnetz } from './VirtualTonnetz';
import type { MidiData } from '@/hooks/useMidiPlayer';
import { Monitor, Smartphone, Tv, Square, RectangleHorizontal } from 'lucide-react';
// import { useMidiContext } from '@/contexts/MidiContext';
import { useNotation } from '@/contexts/NotationContext';

// Helper function to format time as MM:SS
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

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
  const [startThumb, setStartThumb] = useState(startValue);
  const [endThumb, setEndThumb] = useState(endValue);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStartThumb(startValue);
    setEndThumb(endValue);
  }, [startValue, endValue]);

  const handleMouseDown = (e: React.MouseEvent, thumb: 'start' | 'end') => {
    e.preventDefault();
    setIsDragging(thumb);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const value = min + (max - min) * percentage;
    const roundedValue = Math.round(value / step) * step;

    if (isDragging === 'start') {
      const newStart = Math.min(roundedValue, endThumb - step);
      setStartThumb(newStart);
      onStartChange(newStart);
    } else {
      const newEnd = Math.max(roundedValue, startThumb + step);
      setEndThumb(newEnd);
      onEndChange(newEnd);
    }
  }, [isDragging, startThumb, endThumb, min, max, step, onStartChange, onEndChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const startPercentage = ((startThumb - min) / (max - min)) * 100;
  const endPercentage = ((endThumb - min) / (max - min)) * 100;

  return (
    <div ref={sliderRef} className="dual-range-slider" style={style}>
      <div className="dual-range-slider__track" />
      <div
        className="dual-range-slider__selected"
        style={{
          left: `${startPercentage}%`,
          width: `${endPercentage - startPercentage}%`
        }}
      />
      <div
        className="dual-range-slider__thumb"
        style={{ left: `${startPercentage}%` }}
        onMouseDown={(e) => handleMouseDown(e, 'start')}
      />
      <div
        className="dual-range-slider__thumb"
        style={{ left: `${endPercentage}%` }}
        onMouseDown={(e) => handleMouseDown(e, 'end')}
      />
    </div>
  );
}

// New preview component that shows actual animation frame
function ExportPreviewCanvas({ 
  aspectRatio, 
  zoom, 
  mode, 
  chordType, 
  midiData, 
  getNoteName 
}: { 
  aspectRatio: string; 
  zoom: number; 
  mode: 'note' | 'chord' | 'arpeggio'; 
  chordType: string; 
  midiData?: MidiData | null; 
  getNoteName: (tone: number) => string; 
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const virtualTonnetzRef = useRef<VirtualTonnetz | null>(null);

  // Calculate preview dimensions based on aspect ratio
  const calculatePreviewDimensions = useCallback((aspectRatio: string) => {
    const maxPreviewWidth = 280;
    const maxPreviewHeight = 280;

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

    return { width, height };
  }, []);

  // Update preview when settings change
  const updatePreview = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dimensions = calculatePreviewDimensions(aspectRatio);
    
    // Check if dimensions are valid
    if (dimensions.width <= 0 || dimensions.height <= 0) {
      console.error('Invalid preview dimensions:', dimensions);
      return;
    }
    
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Create virtual tonnetz for preview or update existing one
    if (!virtualTonnetzRef.current) {
      try {
        virtualTonnetzRef.current = new VirtualTonnetz(canvas, ctx, {
          mode,
          chordType,
          getNoteName
        });
      } catch (error) {
        console.error('Error creating VirtualTonnetz for preview:', error);
        return;
      }
    } else {
      try {
        // Update dimensions of existing VirtualTonnetz
        virtualTonnetzRef.current.updateDimensions(dimensions.width, dimensions.height);
      } catch (error) {
        console.error('Error updating VirtualTonnetz dimensions:', error);
        return;
      }
    }

    // Update the virtual tonnetz with current settings
    const virtualTonnetz = virtualTonnetzRef.current;
    try {
      virtualTonnetz.updateDensity(Math.round(20 / zoom));
      
      // Simulate a frame at 25% through the animation
      const previewTime = midiData ? (midiData.duration * 0.25) : 2.0;
      virtualTonnetz.update(previewTime, midiData);
    } catch (error) {
      console.error('Error updating VirtualTonnetz preview:', error);
      return;
    }
  }, [aspectRatio, zoom, mode, chordType, midiData, calculatePreviewDimensions, getNoteName]);

  // Update preview when settings change
  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  // Recreate VirtualTonnetz when mode or chordType changes
  useEffect(() => {
    if (virtualTonnetzRef.current) {
      virtualTonnetzRef.current = null; // Force recreation
      updatePreview();
    }
  }, [mode, chordType, updatePreview]);

  return (
    <canvas
      ref={canvasRef}
      className="export-modal-preview-canvas"
      style={{
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain'
      }}
    />
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
  const { getNoteName } = useNotation();

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

  return (
    <div className="export-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="export-modal">
        <button
          onClick={onClose}
          className="export-modal-btn export-modal-close"
          title="Close"
          aria-label="Close Export Modal"
        >
          ×
        </button>

        <div className="export-modal__content">
          {/* Desktop Layout */}
          <div className="export-modal__desktop-layout">
            {/* Preview Container */}
            <div className="export-modal__preview-container">
              <div className="export-modal-preview-area">
                {/* Replace canvas with placeholder */}
                <ExportPreviewCanvas 
                  aspectRatio={settings.aspectRatio} 
                  zoom={settings.zoom} 
                  mode={mode} 
                  chordType={chordType} 
                  midiData={midiData} 
                  getNoteName={getNoteName} 
                />
              </div>
              
              {/* Sliders Section */}
              <div className="export-modal__sliders-section">
                {/* Zoom Slider */}
                <div className="export-modal__slider-group">
                  <label className="export-modal__slider-label">Zoom</label>
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
                </div>

                {/* Time Range Slider */}
                <div className="export-modal__slider-group">
                  <label className="export-modal__slider-label">Time Range</label>
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
                  <div className="export-modal__time-range-info">
                    <span>Start: {formatTime(settings.startTime)}</span>
                    <span>End: {formatTime(settings.endTime)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls Container */}
            <div className="export-modal__controls-container">
              {/* Aspect Ratio Section */}
              <div className="export-modal__aspect-section">
                <h3 className="export-modal__section-title">Aspect Ratio</h3>
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

              {/* Quality Section */}
              <div className="export-modal__quality-section">
                <h3 className="export-modal__section-title">Quality</h3>
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

          {/* Mobile Layout */}
          <div className="export-modal__mobile-layout">
            {/* Preview Container */}
            <div className="export-modal__preview-container">
              <div className="export-modal-preview-area">
                {/* Replace canvas with placeholder */}
                <ExportPreviewCanvas 
                  aspectRatio={settings.aspectRatio} 
                  zoom={settings.zoom} 
                  mode={mode} 
                  chordType={chordType} 
                  midiData={midiData} 
                  getNoteName={getNoteName} 
                />
              </div>
              
              {/* Sliders Section */}
              <div className="export-modal__sliders-section">
                {/* Zoom Slider */}
                <div className="export-modal__slider-group">
                  <label className="export-modal__slider-label">Zoom</label>
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
                </div>

                {/* Time Range Slider */}
                <div className="export-modal__slider-group">
                  <label className="export-modal__slider-label">Time Range</label>
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
                  <div className="export-modal__time-range-info">
                    <span>Start: {formatTime(settings.startTime)}</span>
                    <span>End: {formatTime(settings.endTime)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls Container */}
            <div className="export-modal__controls-container">
              {/* Aspect Ratio Section */}
              <div className="export-modal__aspect-section">
                <h3 className="export-modal__section-title">Aspect Ratio</h3>
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

              {/* Quality Section */}
              <div className="export-modal__quality-section">
                <h3 className="export-modal__section-title">Quality</h3>
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
        <button
          onClick={handleExport}
          className="export-video-btn"
          style={{ width: '100%' }}
          aria-label="Export Video"
        >
          Export Video
        </button>
      </div>
    </div>
  );
} 