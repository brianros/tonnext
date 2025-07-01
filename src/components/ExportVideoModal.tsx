'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { VirtualTonnetz } from './VirtualTonnetz';
import { Monitor, Smartphone, Tv, Square, RectangleHorizontal } from 'lucide-react';

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
  { value: '16:9', label: 'Landscape (16:9)', icon: <Monitor size={20} /> },
  { value: '9:16', label: 'Portrait (9:16)', icon: <Smartphone size={20} /> },
  { value: '4:3', label: 'Classic (4:3)', icon: <Tv size={20} /> },
  { value: '1:1', label: 'Square (1:1)', icon: <Square size={20} /> },
  { value: '4:5', label: 'Social (4:5)', icon: <RectangleHorizontal size={20} /> },
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
    <div className="export-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="export-modal-outer" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center', paddingTop: '24px', paddingBottom: '24px' }}>
        <div className="export-modal" style={{ position: 'relative', paddingTop: '32px', paddingLeft: '32px', paddingRight: '32px' }}>
          <button
            onClick={onClose}
            className="export-modal-btn export-modal-close"
            title="Close"
            style={{ position: 'absolute', top: 12, right: 18, zIndex: 2 }}
          >
            ×
          </button>
          <div className="export-modal-content" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '340px', gap: '48px' }}>
            <div className="export-modal-preview-col">
              <h3 className="export-modal-preview-title">Preview</h3>
              <div className="export-modal-preview-area" style={{ width: '260px', height: '260px' }}>
                <canvas
                  ref={previewCanvasRef}
                  className="export-modal-preview-canvas"
                  style={{ maxWidth: '90%', maxHeight: '90%' }}
                />
              </div>
              <div className="export-modal-zoom" style={{ width: '100%', marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={settings.zoom}
                  onChange={(e) => setSettings(prev => ({ ...prev, zoom: parseFloat(e.target.value) }))}
                  className="export-modal-zoom-slider"
                  style={{ accentColor: 'var(--color-accent)', height: '4px', margin: '4px 0', width: '173px', background: '#D4D7CB', borderRadius: '2px' }}
                />
              </div>
            </div>
            <div className="export-modal-controls" style={{ height: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginTop: '60px' }}>
              <div className="export-modal-aspect">
                <div className="export-modal-aspect-list">
                  {ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio.value}
                      onClick={() => setSettings(prev => ({ ...prev, aspectRatio: ratio.value }))}
                      className={`export-modal-aspect-btn${settings.aspectRatio === ratio.value ? ' selected' : ''}`}
                    >
                      <div className="export-modal-aspect-icon">{ratio.icon}</div>
                      <div className="export-modal-aspect-label">{ratio.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="export-modal-audio">
                <input
                  type="checkbox"
                  id="include-audio"
                  checked={settings.includeAudio}
                  onChange={(e) => setSettings(prev => ({ ...prev, includeAudio: e.target.checked }))}
                  disabled={!midiData}
                  className="export-modal-audio-checkbox"
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                <label htmlFor="include-audio" className={`export-modal-audio-label${!midiData ? ' disabled' : ''}`}>
                  Include MIDI audio {!midiData && '(Load MIDI file first)'}
                </label>
              </div>
            </div>
          </div>
          <div className="export-modal-footer" style={{ marginTop: 0 }}>
            <button
              onClick={handleExport}
              className="blend-btn"
              style={{ minWidth: 140 }}
            >
              Export Video
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 