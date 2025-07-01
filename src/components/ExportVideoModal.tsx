'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { VirtualTonnetz } from './VirtualTonnetz';

interface ExportVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (settings: ExportSettings) => void;
  originalCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  midiData?: any;
  mode: 'note' | 'chord' | 'arpeggio';
  chordType: string;
}

interface ExportSettings {
  duration: number;
  speedMultiplier: number;
  targetFrameRate: number;
  includeAudio: boolean;
  aspectRatio: string;
  targetWidth: number;
  zoom: number;
}

const ASPECT_RATIOS = [
  { value: 'original', label: 'Original', icon: '📐' },
  { value: '16:9', label: 'Landscape (16:9)', icon: '🖥️' },
  { value: '9:16', label: 'Portrait (9:16)', icon: '📱' },
  { value: '4:3', label: 'Classic (4:3)', icon: '📺' },
  { value: '1:1', label: 'Square (1:1)', icon: '⬜' },
];

export default function ExportVideoModal({
  isOpen,
  onClose,
  onExport,
  originalCanvasRef,
  midiData,
  mode,
  chordType
}: ExportVideoModalProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const virtualTonnetzRef = useRef<VirtualTonnetz | null>(null);
  
  const [settings, setSettings] = useState<ExportSettings>({
    duration: midiData?.duration || 30,
    speedMultiplier: 1,
    targetFrameRate: 30,
    includeAudio: false,
    aspectRatio: 'original',
    targetWidth: 1920,
    zoom: 1.0
  });

  // Calculate preview dimensions based on aspect ratio
  const calculatePreviewDimensions = useCallback((aspectRatio: string, zoom: number) => {
    const maxPreviewWidth = 400;
    const maxPreviewHeight = 300;
    
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
      case 'original':
      default:
        if (originalCanvasRef.current) {
          const scale = Math.min(maxPreviewWidth / originalCanvasRef.current.width, maxPreviewHeight / originalCanvasRef.current.height);
          width = Math.round(originalCanvasRef.current.width * scale);
          height = Math.round(originalCanvasRef.current.height * scale);
        } else {
          width = maxPreviewWidth;
          height = maxPreviewHeight;
        }
        break;
    }
    
    // Don't apply zoom to dimensions - zoom affects density instead
    return {
      width,
      height
    };
  }, [originalCanvasRef]);

  // Update preview canvas
  const updatePreview = useCallback(() => {
    if (!previewCanvasRef.current || !originalCanvasRef.current) return;
    
    const previewCanvas = previewCanvasRef.current;
    const { width, height } = calculatePreviewDimensions(settings.aspectRatio, settings.zoom);
    
    previewCanvas.width = width;
    previewCanvas.height = height;
    
    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;
    // Always clear and fill with Tonnetz background color
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.fillStyle = '#D4D7CB';
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    
    // Calculate density based on zoom (higher zoom = lower density = nodes closer together)
    const baseDensity = 20;
    const density = Math.round(baseDensity / settings.zoom);
    
    // Always create a new VirtualTonnetz instance after resizing
    virtualTonnetzRef.current = new VirtualTonnetz(previewCanvas, ctx, { mode, chordType, density });
    
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
      setSettings(prev => ({ ...prev, duration: midiData.duration }));
    }
  }, [midiData?.duration]);

  // Update preview when settings change
  useEffect(() => {
    if (isOpen) {
      updatePreview();
    }
  }, [isOpen, updatePreview]);

  const handleExport = () => {
    onExport(settings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div 
        className="tour-tooltip"
        style={{
          position: 'static',
          maxWidth: '900px',
          width: '90vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-white">Export Video</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Two-column layout */}
          <div className="flex flex-row gap-8">
            {/* Left: Preview Section */}
            <div style={{ flex: 1, minWidth: 320 }}>
              <h3 className="text-lg font-semibold mb-4 text-white">Preview</h3>
              <div className="border-2 border-var(--color-accent) rounded-lg p-4 bg-black bg-opacity-20 flex items-center justify-center">
                <canvas
                  ref={previewCanvasRef}
                  className="border border-var(--color-accent) rounded"
                  style={{ maxWidth: '100%', maxHeight: '300px' }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-2 text-center">
                {calculatePreviewDimensions(settings.aspectRatio, settings.zoom).width} × {calculatePreviewDimensions(settings.aspectRatio, settings.zoom).height} px
                <br />
                Density: {Math.round(20 / settings.zoom)} (Zoom: {Math.round(settings.zoom * 100)}%)
              </div>
            </div>

            {/* Right: Controls Section */}
            <div style={{ flex: 1, minWidth: 320 }} className="space-y-6">
              {/* Aspect Ratio */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-white">Aspect Ratio</h3>
                <div className="grid grid-cols-2 gap-2">
                  {ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio.value}
                      onClick={() => setSettings(prev => ({ ...prev, aspectRatio: ratio.value }))}
                      className={`p-3 border rounded-lg text-left transition-colors ${
                        settings.aspectRatio === ratio.value
                          ? 'border-var(--color-accent) bg-var(--color-accent) text-white'
                          : 'border-var(--color-highlight) hover:border-var(--color-accent) text-white'
                      }`}
                    >
                      <div className="text-lg">{ratio.icon}</div>
                      <div className="text-sm font-medium">{ratio.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Zoom Control */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-white">Zoom</h3>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={settings.zoom}
                    onChange={(e) => setSettings(prev => ({ ...prev, zoom: parseFloat(e.target.value) }))}
                    className="w-full"
                    style={{
                      accentColor: 'var(--color-accent)'
                    }}
                  />
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>50%</span>
                    <span className="font-medium text-white">{Math.round(settings.zoom * 100)}%</span>
                    <span>200%</span>
                  </div>
                </div>
              </div>

              {/* Include Audio Checkbox */}
              <div className="flex items-center mt-4">
                <input
                  type="checkbox"
                  id="include-audio"
                  checked={settings.includeAudio}
                  onChange={(e) => setSettings(prev => ({ ...prev, includeAudio: e.target.checked }))}
                  disabled={!midiData}
                  className="mr-2"
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                <label htmlFor="include-audio" className={`text-sm text-white ${!midiData ? 'text-gray-400' : ''}`}>
                  Include MIDI audio {!midiData && '(Load MIDI file first)'}
                </label>
              </div>

            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-var(--color-accent)">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded"
              style={{
                background: 'var(--color-highlight)',
                color: 'var(--color-main)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              className="px-6 py-2 text-sm font-medium rounded"
              style={{
                background: 'var(--color-accent)',
                color: 'white',
              }}
            >
              Export Video
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 