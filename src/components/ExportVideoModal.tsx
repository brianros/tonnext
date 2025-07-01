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

  const [quality, setQuality] = useState('High');

  // Calculate preview dimensions based on aspect ratio
  const calculatePreviewDimensions = useCallback((aspectRatio: string, zoom: number) => {
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

  // Ensure aspect ratio is always a valid key for QUALITY_PRESETS
  const validAspectRatios = Object.keys(QUALITY_PRESETS);
  const aspectKey = validAspectRatios.includes(settings.aspectRatio) ? settings.aspectRatio : '16:9';

  // Update targetWidth and aspect ratio height when quality or aspect ratio changes
  useEffect(() => {
    const preset = QUALITY_PRESETS[aspectKey]?.find(q => q.label === quality) || QUALITY_PRESETS['16:9'][2];
    setSettings(prev => ({ ...prev, targetWidth: preset.width }));
  }, [quality, aspectKey]);

  const handleExport = () => {
    onExport(settings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="export-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="export-modal-outer" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center', paddingTop: '24px', paddingBottom: '24px' }}>
        <div className="export-modal" style={{ position: 'relative', paddingTop: '48px', width: '100%' }}>
          <button
            onClick={onClose}
            className="export-modal-btn export-modal-close"
            title="Close"
            style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, borderRadius: 12 }}
          >
            ×
          </button>
          <div className="export-modal-content" style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', minHeight: '340px', gap: '48px', paddingLeft: '32px', paddingRight: '32px' }}>
            <div className="export-modal-preview-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '48px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
                  <div className="export-modal-preview-area" style={{ width: '280px', height: '280px' }}>
                    <canvas
                      ref={previewCanvasRef}
                      className="export-modal-preview-canvas"
                      style={{ maxWidth: '90%', maxHeight: '90%' }}
                    />
                  </div>
                  <div className="export-modal-zoom" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.9rem', color: '#fff', fontWeight: '500' }}>Zoom</label>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={settings.zoom}
                      onChange={(e) => setSettings(prev => ({ ...prev, zoom: parseFloat(e.target.value) }))}
                      className="export-modal-zoom-slider"
                      style={{ accentColor: 'var(--color-accent)', height: '4px', margin: '4px 0', width: '200px', background: '#D4D7CB', borderRadius: '2px' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
                  <div className="export-modal-right-group" style={{ width: '180px', height: '280px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '18px' }}>
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
                    <div className="export-modal-quality-group" style={{ width: '100%', marginTop: '8px', display: 'flex', gap: '8px' }}>
                      {QUALITY_PRESETS[aspectKey]?.map((q: { label: string; width: number; height: number; }) => (
                        <button
                          key={q.label}
                          onClick={() => setQuality(q.label)}
                          className={`export-modal-aspect-btn${quality === q.label ? ' selected' : ''}`}
                          style={{ flex: 1, textAlign: 'center' }}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="export-modal-audio" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.9rem', color: '#fff', fontWeight: '500' }}>Audio</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="include-audio"
                        checked={settings.includeAudio}
                        onChange={(e) => setSettings(prev => ({ ...prev, includeAudio: e.target.checked }))}
                        disabled={!midiData}
                        className="export-modal-audio-checkbox"
                        style={{ accentColor: 'var(--color-accent)' }}
                      />
                      <label htmlFor="include-audio" className={`export-modal-audio-label${!midiData ? ' disabled' : ''}`} style={{ fontSize: '0.85rem' }}>
                        Include MIDI audio {!midiData && '(Load MIDI file first)'}
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="export-modal-footer" style={{ marginTop: 0, padding: 0, width: '100%' }}>
            <button
              onClick={handleExport}
              className="blend-btn"
              style={{ width: '100%', padding: 0 }}
            >
              Export Video
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 