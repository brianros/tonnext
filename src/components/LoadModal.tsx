'use client';

import React, { useState, useRef, useCallback } from 'react';
import { FolderUp, Youtube, Loader2 } from 'lucide-react';

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
    <div className="load-modal-overlay">
      <div className="load-modal">
        {/* Close button */}
        <button
          onClick={onClose}
          className="export-modal-btn export-modal-close"
          title="Close"
        >
          ×
        </button>

        <h2 className="load-modal__title">Load Music</h2>

        {/* Tab buttons */}
        <div className="load-modal__tabs">
          <button
            onClick={() => setActiveTab('file')}
            className={`load-modal__tab-btn${activeTab === 'file' ? ' active' : ''}`}
          >
            <FolderUp size={20} style={{ marginRight: '0.3rem', display: 'inline' }} />
            File Upload
          </button>
          <button
            onClick={() => setActiveTab('youtube')}
            className={`load-modal__tab-btn${activeTab === 'youtube' ? ' active' : ''}`}
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
              className={`load-modal__upload-area${dragActive ? ' drag-active' : ''}`}
              onClick={handleUploadClick}
            >
              <FolderUp size={38} className="load-modal__upload-icon" />
              <p className="load-modal__upload-title">
                {dragActive ? 'Drop your file here' : 'Click to browse or drag & drop'}
              </p>
              <p className="load-modal__upload-desc">
                Supports MIDI files and audio files (MP3, WAV, OGG, FLAC, etc.)
              </p>
            </div>

            {/* Conversion progress */}
            {isConverting && (
              <div className="load-modal__conversion-overlay export-modal-overlay">
                <div className="load-modal__conversion-outer export-modal-outer">
                  <div className="load-modal__conversion-modal export-modal">
                    {/* Spinner */}
                    <div className="load-modal__conversion-spinner">
                      <Loader2 className="animate-spin" />
                    </div>
                    <h3 className="load-modal__conversion-title">Converting…</h3>
                    <p className="load-modal__conversion-status">{conversionStatus}</p>
                    {/* Progress Bar */}
                    {typeof conversionProgress === 'number' && conversionProgress > 0 && (
                      <div className="load-modal__progress-bar-container">
                        <div
                          className="load-modal__progress-bar"
                          style={{ width: `${conversionProgress}%` }}
                        />
                      </div>
                    )}
                    <button
                      onClick={onClose}
                      className="load-modal__cancel-btn blend-btn"
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
            <form onSubmit={handleYouTubeSubmit} className="load-modal__youtube-form">
              <div>
                <label htmlFor="youtube-url" className="load-modal__youtube-label">
                  YouTube URL
                </label>
                <input
                  id="youtube-url"
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="load-modal__youtube-input"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={!youtubeUrl.trim() || isConverting}
                className="load-modal__youtube-btn"
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

            <div className="load-modal__info-box">
              <p className="load-modal__info-text">
                <strong>Note:</strong> YouTube processing may take a few moments. The video will be converted to audio, then to MIDI for visualization.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
