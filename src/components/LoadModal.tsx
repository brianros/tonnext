'use client';

import React, { useState, useRef, useCallback } from 'react';
import { FolderUp, Youtube, X, Loader2 } from 'lucide-react';

interface LoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (file: File) => Promise<void>;
  onYouTubeUrl: (url: string) => Promise<void>;
  isConverting?: boolean;
  conversionStatus?: string | null;
  conversionProgress?: number;
}

export default function LoadModal({
  isOpen,
  onClose,
  onFileSelect,
  onYouTubeUrl,
  isConverting = false,
  conversionStatus = null,
  conversionProgress = 0
}: LoadModalProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'youtube'>('file');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    await onFileSelect(file);
    // Don't close modal immediately for audio files that need conversion
    if (file.type === 'audio/midi' || file.name.endsWith('.mid')) {
      onClose();
    }
  }, [onFileSelect, onClose]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      await onFileSelect(files[0]);
      // Don't close modal immediately for audio files that need conversion
      if (files[0].type === 'audio/midi' || files[0].name.endsWith('.mid')) {
        onClose();
      }
    }
  }, [onFileSelect, onClose]);

  const handleYouTubeSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    
    await onYouTubeUrl(youtubeUrl.trim());
    setYoutubeUrl('');
    // Don't close modal immediately as YouTube processing might take time
  }, [youtubeUrl, onYouTubeUrl]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div className="load-modal">
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '1.5rem',
            padding: '0.5rem',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <X size={20} />
        </button>

        <h2 style={{ margin: '0 0 1.2rem 0', fontSize: '1.2rem', textAlign: 'center' }}>
          Load Music
        </h2>

        {/* Tab buttons */}
        <div style={{
          display: 'flex',
          marginBottom: '1rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        }}>
          <button
            onClick={() => setActiveTab('file')}
            style={{
              flex: 1,
              padding: '0.5rem',
              background: activeTab === 'file' ? 'var(--color-accent)' : 'transparent',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: activeTab === 'file' ? 'bold' : 'normal',
              borderBottom: activeTab === 'file' ? '2px solid var(--color-accent)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            <FolderUp size={20} style={{ marginRight: '0.3rem', display: 'inline' }} />
            File Upload
          </button>
          <button
            onClick={() => setActiveTab('youtube')}
            style={{
              flex: 1,
              padding: '0.5rem',
              background: activeTab === 'youtube' ? 'var(--color-accent)' : 'transparent',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: activeTab === 'youtube' ? 'bold' : 'normal',
              borderBottom: activeTab === 'youtube' ? '2px solid var(--color-accent)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            <Youtube size={20} style={{ marginRight: '0.3rem', display: 'inline' }} />
            YouTube
          </button>
        </div>

        {/* File Upload Tab */}
        {activeTab === 'file' && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mid,audio/midi,audio/*,.mp3,.wav,.ogg,.flac,.aac,.m4a,.webm"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              style={{
                border: '2px dashed rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                padding: '1.2rem',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: dragActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                borderColor: dragActive ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.3)',
                maxWidth: '340px',
                margin: '0 auto',
              }}
              onClick={handleUploadClick}
            >
              <FolderUp size={38} style={{ marginBottom: '0.7rem', opacity: 0.7 }} />
              <p style={{ margin: '0 0 0.3rem 0', fontSize: '1rem' }}>
                {dragActive ? 'Drop your file here' : 'Click to browse or drag & drop'}
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>
                Supports MIDI files and audio files (MP3, WAV, OGG, FLAC, etc.)
              </p>
            </div>

            {/* Conversion progress */}
            {isConverting && (
              <div className="export-modal-overlay" style={{ zIndex: 1000 }}>
                <div
                  className="export-modal-outer"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingTop: '24px',
                    paddingBottom: '24px',
                  }}
                >
                  <div
                    className="export-modal"
                    style={{
                      position: 'relative',
                      padding: '48px 32px 32px 32px',
                      borderRadius: '18px',
                      background: 'var(--color-main)',
                      boxShadow: '0 4px 32px rgba(0,0,0,0.18)',
                      minWidth: 360,
                      minHeight: 180,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    {/* Spinner */}
                    <div style={{ marginBottom: '1rem' }}>
                      <Loader2
                        className="animate-spin"
                        style={{
                          fontSize: '2.5rem',
                          color: 'var(--color-accent)',
                          display: 'block',
                          margin: '0 auto'
                        }}
                      />
                    </div>
                    <h3 style={{ margin: '0.5rem 0', fontSize: '1.5rem', color: '#fff', fontWeight: 700, textAlign: 'center' }}>Converting…</h3>
                    <p style={{ margin: '0.5rem 0', fontSize: '1.1rem', color: '#fff', opacity: 0.85, textAlign: 'center' }}>{conversionStatus}</p>
                    {/* Progress Bar */}
                    {typeof conversionProgress === 'number' && conversionProgress > 0 && (
                      <div style={{
                        width: '100%',
                        height: '8px',
                        backgroundColor: '#222',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        margin: '16px 0',
                      }}>
                        <div style={{
                          width: `${conversionProgress}%`,
                          height: '100%',
                          backgroundColor: 'var(--color-accent)',
                          borderRadius: '4px',
                          transition: 'width 0.3s',
                        }} />
                      </div>
                    )}
                    <button
                      onClick={onClose}
                      className="blend-btn"
                      style={{
                        background: '#ef4444',
                        color: '#fff',
                        borderRadius: 8,
                        padding: '12px 32px',
                        fontWeight: 600,
                        fontSize: 18,
                        marginTop: 24,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                        border: 'none',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel Conversion
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* YouTube Tab */}
        {activeTab === 'youtube' && (
          <div>
            <form onSubmit={handleYouTubeSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="youtube-url" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  YouTube URL
                </label>
                <input
                  id="youtube-url"
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    color: '#fff',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                  }}
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={!youtubeUrl.trim() || isConverting}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-accent)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '1rem',
                  cursor: youtubeUrl.trim() && !isConverting ? 'pointer' : 'not-allowed',
                  opacity: youtubeUrl.trim() && !isConverting ? 1 : 0.5,
                }}
              >
                {isConverting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
                    Processing...
                  </>
                ) : (
                  <>
                    <Youtube size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
                    Load from YouTube
                  </>
                )}
              </button>
            </form>

            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>
                <strong>Note:</strong> YouTube processing may take a few moments. The video will be converted to audio, then to MIDI for visualization.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
