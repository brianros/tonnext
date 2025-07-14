'use client';

import React from 'react';
import { useState, useRef, useEffect } from 'react';
import Settings from '@/components/Settings';
import TonnextCanvas from '@/components/TonnextCanvas';
import MidiPlayerCompact from '@/components/MidiPlayerCompact';
import { MidiProvider, useMidiContext } from '@/contexts/MidiContext';
import { useMidiPlayer } from '@/hooks/useMidiPlayer';
import CustomPaletteModal, { Palette } from '@/components/CustomPaletteModal';
import LoadingLogo from '@/components/LoadingLogo';
import Tour from '@/components/Tour';
import InstrumentSelector, { Instrument } from '@/components/InstrumentSelector';
import { Music3, Music4, ListMusic, Settings as SettingsIcon, Piano } from 'lucide-react';

// Tooltip component for acknowledgments
function AcknowledgmentsTooltip({ isVisible, anchorRect, onMouseEnter, onMouseLeave }: { isVisible: boolean; anchorRect: DOMRect | null; onMouseEnter: () => void; onMouseLeave: () => void }) {

  if (!isVisible || !anchorRect) return null;

  // Ensure the tooltip doesn't go off-screen
  const maxWidth = Math.min(500, window.innerWidth - 20);
  const left = Math.max(10, Math.min(anchorRect.left, window.innerWidth - maxWidth - 10));
  const top = anchorRect.bottom + 2; // Reduced gap from 4 to 2

  const style: React.CSSProperties = {
    position: 'fixed',
    top: top,
    left: left,
    background: 'var(--color-main)',
    color: '#fff',
    padding: '24px',
    borderRadius: '12px',
    border: '2px solid var(--color-highlight)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    zIndex: 10000,
    maxWidth: maxWidth,
    width: 'auto',
    fontSize: '0.9rem',
    lineHeight: '1.5',
    animation: 'fadeIn 0.2s ease-out',
  };

  return (
    <div 
      className="acknowledgments-tooltip"
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
              <div style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>About Tonnext</h3>
        </div>
      <p style={{ marginBottom: '16px' }}>
        Tonnext is an interactive Tonnetz visualization tool that explores musical relationships through geometric patterns. 
        Click on nodes to play notes, chords, or arpeggios, and load MIDI files to see the music visualized in real-time.
      </p>
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 'bold' }}>Acknowledgments</h4>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li style={{ marginBottom: '4px' }}>
            <strong>Tonnetz Visualization:</strong> Inspired by{' '}
            <a href="https://github.com/cifkao/tonnetz-viz" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
              cifkao/tonnetz-viz
            </a>
          </li>
          <li style={{ marginBottom: '4px' }}>
            <strong>Audio-to-MIDI Conversion:</strong> Powered by{' '}
            <a href="https://github.com/spotify/basic-pitch" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
              Spotify Basic Pitch
            </a>
          </li>
          <li style={{ marginBottom: '4px' }}>
            <strong>Tonnetz Theory:</strong> Based on the{' '}
            <a href="https://en.wikipedia.org/wiki/Tonnetz" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
              Tonnetz
            </a>
            {' '}mathematical model
          </li>
          <li style={{ marginBottom: '4px' }}>
            <strong>Development:</strong> Created by{' '}
            <a href="https://github.com/brianros" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
              Brian Rosenfeld
            </a>
          </li>
        </ul>
      </div>
      <div style={{ textAlign: 'center', fontSize: '0.8rem', opacity: 0.8 }}>
        <a href="https://mirari.ar" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
          mīrārī
        </a>
        {' '}2025
      </div>
    </div>
  );
}

// Palette presets must match those in Settings
const PALETTE_PRESETS = [
  { name: 'Cinnabar', main: '#DA4C2B' },
  { name: 'Aurora', main: '#1A535C' },
  { name: 'Retro Pop', main: '#22223B' },
  { name: 'Forest Haze', main: '#386641' },
  { name: 'Neon Night', main: '#6C1CD1' },
];

// Helper to get palette for preview
const PALETTE_PREVIEW = {
  'Cinnabar': {
    main: '#DA4C2B', highlight: '#D4D7CB', accent: '#D7A798', hover: '#DD4A2F', hover2: '#DB4A2F',
  },
  'Aurora': {
    main: '#2E8BC0', highlight: '#B1D4E0', accent: '#145DA0', hover: '#0C2D48', hover2: '#F7F7FF',
  },
  'Retro Pop': {
    main: '#22223B', highlight: '#F2E9E4', accent: '#9A8C98', hover: '#C9ADA7', hover2: '#4A4E69',
  },
  'Forest Haze': {
    main: '#386641', highlight: '#F2E8CF', accent: '#A7C957', hover: '#6A994E', hover2: '#BC4749',
  },
  'Neon Night': {
    main: '#FF2A6D', highlight: '#00F0FF', accent: '#2D00F7', hover: '#F6F930', hover2: '#FF6F61',
  },
};

// Grouped chord types for menu organization
const CHORD_GROUPS = [
  {
    label: 'Triads',
    options: [
      { value: 'major', label: 'Major' },
      { value: 'minor', label: 'Minor' },
      { value: 'diminished', label: 'Diminished' },
      { value: 'augmented', label: 'Augmented' },
    ],
  },
  {
    label: 'Sixth Chords',
    options: [
      { value: 'major6', label: 'Major 6th' },
      { value: 'minor6', label: 'Minor 6th' },
    ],
  },
  {
    label: 'Seventh Chords',
    options: [
      { value: 'major7', label: 'Major 7th' },
      { value: 'minor7', label: 'Minor 7th' },
      { value: 'dominant7', label: 'Dominant 7th' },
      { value: 'diminished7', label: 'Diminished 7th' },
      { value: 'half-diminished7', label: 'Half-diminished 7th (m7♭5)' },
      { value: 'minorMajor7', label: 'Minor Major 7th' },
      { value: 'augmented7', label: 'Augmented 7th' },
      { value: '7b5', label: '7th Flat 5 (7♭5)' },
      { value: '7#5', label: '7th Sharp 5 (7♯5)' },
      { value: 'm7b5', label: 'Minor 7th Flat 5 (m7♭5)' },
      { value: 'sus2_7', label: 'Sus2 7th' },
      { value: 'sus4_7', label: 'Sus4 7th' },
    ],
  },
  {
    label: 'Suspended Chords',
    options: [
      { value: 'sus2', label: 'Suspended 2nd (sus2)' },
      { value: 'sus4', label: 'Suspended 4th (sus4)' },
    ],
  },
  {
    label: 'Added Tone Chords',
    options: [
      { value: 'add9', label: 'Add 9' },
      { value: 'madd9', label: 'Minor Add 9' },
      { value: 'add11', label: 'Add 11' },
      { value: 'add13', label: 'Add 13' },
    ],
  },
];

function HomeContent() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mode, setMode] = useState<'note' | 'chord' | 'arpeggio'>('chord');
  const [chordType, setChordType] = useState<string>('major');
  const [appearanceDropdown, setAppearanceDropdown] = useState(false);
  const appearanceBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownTimeout = useRef<NodeJS.Timeout | null>(null);
  const [customPaletteOpen, setCustomPaletteOpen] = useState(false);
  const [customPalette, setCustomPalette] = useState<Palette>({
    main: '#DA4C2B',
    highlight: '#D4D7CB',
    accent: '#D7A798',
    hover: '#DD4A2F',
    hover2: '#DB4A2F',
  });
  
  // Instrument state
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument>({
    id: 'piano',
    name: 'Piano',
    category: 'Keys',
    icon: Piano,
    toneType: 'synth',
    toneOptions: { oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 } }
  });
  
  // Canvas ref for export functionality
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Tour state
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // Loading overlay demo state (disabled)
  const [showLoadingLogo, setShowLoadingLogo] = useState(false);

  // Add state for dropdown
  const [tonnextDropdownOpen, setTonnextDropdownOpen] = useState(false);

  // Add loading state for debugging - set to true by default to disable loading overlay
  const [isAppLoaded, setIsAppLoaded] = useState(true);
  
  // Acknowledgments tooltip state
  const [showAcknowledgments, setShowAcknowledgments] = useState(false);
  const [hoveredTitle, setHoveredTitle] = useState<'desktop' | 'mobile' | null>(null);
  const [isTooltipHovered, setIsTooltipHovered] = useState(false);
  const [desktopTitleRect, setDesktopTitleRect] = useState<DOMRect | null>(null);
  const [mobileTitleRect, setMobileTitleRect] = useState<DOMRect | null>(null);
  const desktopTitleRef = useRef<HTMLHeadingElement>(null);
  const mobileTitleRef = useRef<HTMLHeadingElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLoadingLogoFinish = () => {
    setShowLoadingLogo(false);
  };

  // Initialize MIDI player to ensure shared state
  useMidiPlayer();
  
  // Get MIDI context for instrument updates
  const { setSelectedInstrument: setContextInstrument, getMidiPlayerFunctions } = useMidiContext();
  
  // Debug logging for initialization
  useEffect(() => {
    console.log('HomeContent component mounted');
    console.log('isAppLoaded state:', isAppLoaded);
    console.log('App should be visible now');
  }, [isAppLoaded]);

  // Loading effect removed - app loads immediately
  useEffect(() => {
    console.log('App loaded immediately');
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+T or Cmd+T to start tour
      if ((event.ctrlKey || event.metaKey) && event.key === 't') {
        event.preventDefault();
        if (!isTourOpen && !showLoadingLogo) {
          setIsTourOpen(true);
          localStorage.setItem('tonnext-visited', 'true');
        }
      }
      // Escape to close tour or tonnext dropdown
      if (event.key === 'Escape') {
        if (isTourOpen) {
          setIsTourOpen(false);
        }
        if (tonnextDropdownOpen) {
          setTonnextDropdownOpen(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isTourOpen, showLoadingLogo, tonnextDropdownOpen]);

  // Handler to apply a palette preset by name (delegates to Settings logic)
  const handleApplyPreset = (name: string) => {
    // Find the preset in Settings.tsx (must keep in sync)
    const preset = {
      'Cinnabar': {
        main: '#DA4C2B', highlight: '#D4D7CB', accent: '#D7A798', hover: '#DD4A2F', hover2: '#DB4A2F',
      },
      'Aurora': {
        main: '#2E8BC0', highlight: '#B1D4E0', accent: '#145DA0', hover: '#0C2D48', hover2: '#F7F7FF',
      },
      'Retro Pop': {
        main: '#22223B', highlight: '#F2E9E4', accent: '#9A8C98', hover: '#C9ADA7', hover2: '#4A4E69',
      },
      'Forest Haze': {
        main: '#386641', highlight: '#F2E8CF', accent: '#A7C957', hover: '#6A994E', hover2: '#BC4749',
      },
      'Neon Night': {
        main: '#FF2A6D', highlight: '#00F0FF', accent: '#2D00F7', hover: '#F6F930', hover2: '#FF6F61',
      },
    }[name];
    if (preset) {
      Object.entries(preset).forEach(([key, value]) => {
        document.documentElement.style.setProperty(`--color-${key}`, value);
      });
    }
    setAppearanceDropdown(false);
  };

  // Handler to apply custom palette
  const handleApplyCustomPalette = (palette: Palette) => {
    Object.entries(palette).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--color-${key}`, value);
    });
    setCustomPalette(palette);
    setCustomPaletteOpen(false);
  };

  // Handler to change instrument
  const handleInstrumentChange = async (instrument: Instrument) => {
    console.log('Handling instrument change to:', instrument.name);
    setSelectedInstrument(instrument);
    setContextInstrument(instrument);
    const functions = getMidiPlayerFunctions();
    if (functions) {
      console.log('Updating MIDI player instrument...');
      await functions.updateInstrument(instrument);
      console.log('Instrument update complete');
    } else {
      console.log('No MIDI player functions available');
    }
  };

  useEffect(() => {
    // Set --vh for mobile viewport height fix
    function setVh() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      console.log('Mobile viewport height set to:', vh, 'px (window height:', window.innerHeight, ')');
      
      // Also set a fallback for devices that don't support CSS custom properties well
      if (window.innerWidth <= 768) {
        document.body.style.height = `${window.innerHeight}px`;
        document.documentElement.style.height = `${window.innerHeight}px`;
      }
    }
    setVh();
    window.addEventListener('resize', setVh);
    return () => window.removeEventListener('resize', setVh);
  }, []);

  // Add mobile detection and debugging
  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    console.log('Device detected as:', isMobile ? 'mobile' : 'desktop', 'width:', window.innerWidth);
    
    // Check for mobile-specific issues
    if (isMobile) {
      console.log('Mobile device detected, checking for potential issues...');
      
      // Check if touch events are supported
      const touchSupported = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      console.log('Touch events supported:', touchSupported);
      
      // Check if audio context is supported
      const audioContextSupported = 'AudioContext' in window || 'webkitAudioContext' in window;
      console.log('Audio context supported:', audioContextSupported);
      
      // Check if canvas is supported
      const canvas = document.createElement('canvas');
      const canvasSupported = !!canvas.getContext;
      console.log('Canvas supported:', canvasSupported);
    }
  }, []);

  function ChordDropdown({ value, onChange, buttonClassName, buttonStyle }: { value: string; onChange: (v: string) => void; buttonClassName?: string; buttonStyle?: React.CSSProperties }) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const closeTimeout = useRef<NodeJS.Timeout | null>(null);

    // Close on outside click
    useEffect(() => {
      function handle(e: MouseEvent) {
        if (
          !btnRef.current?.contains(e.target as Node) &&
          !menuRef.current?.contains(e.target as Node)
        ) {
          setOpen(false);
        }
      }
      if (open) document.addEventListener('mousedown', handle);
      return () => document.removeEventListener('mousedown', handle);
    }, [open]);

    // Keyboard navigation
    useEffect(() => {
      function handle(e: KeyboardEvent) {
        if (!open) return;
        if (e.key === 'Escape') setOpen(false);
      }
      if (open) document.addEventListener('keydown', handle);
      return () => document.removeEventListener('keydown', handle);
    }, [open]);

    // Find selected label
    let selectedLabel = '';
    for (const group of CHORD_GROUPS) {
      const found = group.options.find(opt => opt.value === value);
      if (found) selectedLabel = found.label;
    }

    return (
      <div className="dropdown-container" style={{ position: 'relative' }}
        onMouseLeave={() => { closeTimeout.current = setTimeout(() => setOpen(false), 120); }}
        onMouseEnter={() => { if (closeTimeout.current) clearTimeout(closeTimeout.current); }}
        onBlur={e => { if (!menuRef.current?.contains(e.relatedTarget) && !btnRef.current?.contains(e.relatedTarget)) setOpen(false); }}
        tabIndex={-1}
      >
        <button
          ref={btnRef}
          className={buttonClassName ? buttonClassName : "dropdown-button blend-btn"}
          style={buttonStyle ? buttonStyle : {
            width: '320px',
            minWidth: '320px',
            height: '64px',
            fontSize: 'clamp(1rem, 2vw, 1.6rem)',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: open ? 'var(--color-highlight)' : 'var(--color-main)',
            color: open ? 'var(--color-main)' : '#fff',
            border: open ? '2px solid var(--color-highlight)' : '2px solid transparent',
            paddingLeft: 16,
            paddingRight: 16,
            transition: 'all 0.2s cubic-bezier(.4,2,.6,1)',
            boxShadow: open ? '0 2px 12px rgba(0,0,0,0.10)' : 'none',
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          tabIndex={0}
          onMouseEnter={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          // Removed onMouseLeave and onBlur from button
        >
          <span style={{ flex: 1, textAlign: 'left' }}>{selectedLabel || 'Select Chord'}</span>
          <span style={{ fontSize: '1.2rem', lineHeight: 1, transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▲</span>
        </button>
        {open && (
          <div
            ref={menuRef}
            className="dropdown-menu"
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              zIndex: 1000,
              background: 'var(--color-main)',
              color: '#fff',
              border: '2px solid var(--color-highlight)',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              maxHeight: '300px',
              overflowY: 'auto',
              boxShadow: '0 -4px 12px rgba(0,0,0,0.3)',
            }}
            role="listbox"
          >
            {CHORD_GROUPS.map(group => (
              <React.Fragment key={group.label}>
                <div 
                  className="dropdown-group-header"
                  style={{ 
                    padding: '8px 16px', 
                    fontWeight: 'bold', 
                    color: 'var(--color-accent)', 
                    background: 'rgba(0,0,0,0.1)', 
                    fontSize: '0.9rem',
                    borderBottom: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  {group.label}
                </div>
                {group.options.map(opt => (
                  <button
                    key={opt.value}
                    role="option"
                    aria-selected={value === opt.value}
                    tabIndex={0}
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { onChange(opt.value); setOpen(false); }}}
                    className="dropdown-option"
                    style={{
                      width: '100%',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      background: value === opt.value ? 'var(--color-highlight)' : 'transparent',
                      color: value === opt.value ? 'var(--color-main)' : '#fff',
                      border: 'none',
                      textAlign: 'left',
                      fontSize: '0.9rem',
                      fontWeight: value === opt.value ? 'bold' : 'normal',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => { 
                      if (value !== opt.value) {
                        e.currentTarget.style.background = 'var(--color-highlight)';
                        e.currentTarget.style.color = 'var(--color-main)';
                      }
                    }}
                    onMouseLeave={e => { 
                      if (value !== opt.value) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#fff';
                      }
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Show/hide logic with delay
  useEffect(() => {
    if (hoveredTitle || isTooltipHovered) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setShowAcknowledgments(true);
    } else {
      // Add delay before hiding
      hideTimeoutRef.current = setTimeout(() => {
        setShowAcknowledgments(false);
      }, 300);
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [hoveredTitle, isTooltipHovered]);

  return (
    <div className="h-screen flex flex-col" style={{ 
      height: 'calc(var(--vh, 1vh) * 100)', 
      position: 'relative', 
      display: 'flex', 
      flexDirection: 'column' 
    }}>
      {/* Simple loading indicator for debugging */}
      {!isAppLoaded && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--color-main)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          fontSize: '1.2rem',
          fontWeight: 'bold'
        }}>
          Loading Tonnext...
          <button 
            onClick={() => setIsAppLoaded(true)}
            style={{
              marginLeft: '20px',
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            Skip Loading
          </button>
        </div>
      )}
      
      {showLoadingLogo && (
        <LoadingLogo onFinish={handleLoadingLogoFinish} />
      )}
      
      {/* Acknowledgments Tooltip */}
      <AcknowledgmentsTooltip 
        isVisible={showAcknowledgments} 
        anchorRect={hoveredTitle === 'desktop' ? desktopTitleRect : hoveredTitle === 'mobile' ? mobileTitleRect : (isTooltipHovered ? (desktopTitleRect || mobileTitleRect) : null)}
        onMouseEnter={() => setIsTooltipHovered(true)}
        onMouseLeave={() => setIsTooltipHovered(false)}
      />
      
      <div className="main-content" style={{
        filter: showLoadingLogo ? 'blur(6px) brightness(0.7)' : 'none',
        transition: 'filter 0.3s',
        pointerEvents: showLoadingLogo ? 'none' : 'auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Sleek Header */}
        <header className="responsive-header" style={{ background: 'var(--color-main)', height: 'var(--header-footer-height)', minHeight: 'var(--header-footer-height)' }}>
          <div className="header-container">
            {/* Tonnext title - minimal markup */}
            <h1 
              ref={desktopTitleRef}
              className="blend-btn tonnext-title" 
              aria-label="Tonnext Home"
              onMouseEnter={() => {
                setHoveredTitle('desktop');
                if (desktopTitleRef.current) setDesktopTitleRect(desktopTitleRef.current.getBoundingClientRect());
              }}
              onMouseLeave={() => {
                setHoveredTitle(null);
              }}
              style={{ cursor: 'pointer' }}
              title="Hover for acknowledgments"
            >
              Tonnext
            </h1>
            {/* MIDI player container - hidden on mobile, will be in second row */}
            <div className="midi-controller-container flex-shrink-0 hide-on-mobile" data-tour="midi-player" aria-label="MIDI Player Controls">
              <MidiPlayerCompact canvasRef={canvasRef} mode={mode} chordType={chordType} />
            </div>
            {/* Other header buttons */}
            <div className="header-buttons flex items-center flex-shrink-0">
              <div
                className="relative"
                onMouseEnter={() => {
                  if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
                  setAppearanceDropdown(true);
                }}
                onMouseLeave={() => {
                  if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
                  dropdownTimeout.current = setTimeout(() => setAppearanceDropdown(false), 200);
                }}
              >
                <button
                  ref={appearanceBtnRef}
                  className="blend-btn header-btn theme-btn"
                  aria-haspopup="true"
                  aria-expanded={appearanceDropdown}
                  data-tour="appearance"
                  title="Theme Settings"
                  aria-label="Theme Settings"
                >
                  <svg className="theme-icon" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                  </svg>
                </button>
                {appearanceDropdown && (
                  <div
                    className="dropdown-menu"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 1000,
                      background: 'var(--color-main)',
                      color: '#fff',
                      border: '2px solid var(--color-highlight)',
                      borderTop: 'none',
                      borderRadius: '0 0 8px 8px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      minWidth: 200,
                      fontSize: '1rem',
                      padding: 0,
                    }}
                  >
                    {PALETTE_PRESETS.map(preset => {
                      const pal = PALETTE_PREVIEW[preset.name as keyof typeof PALETTE_PREVIEW];
                      // Contrast: if main is dark, use highlight for text; if highlight is dark, use main for text; else fallback to white/black
                      const getLuminance = (hex: string) => {
                        const c = hex.replace('#', '');
                        if (c.length !== 6) return 1;
                        const r = parseInt(c.slice(0, 2), 16) / 255;
                        const g = parseInt(c.slice(2, 4), 16) / 255;
                        const b = parseInt(c.slice(4, 6), 16) / 255;
                        return 0.299 * r + 0.587 * g + 0.114 * b;
                      };
                      const mainLum = getLuminance(pal.main);
                      const highlightLum = getLuminance(pal.highlight);
                      let textColor = '#fff';
                      if (preset.name === 'Cinnabar') textColor = '#fff';
                      else if (mainLum < 0.5 && highlightLum > 0.5) textColor = pal.highlight;
                      else if (mainLum > 0.5 && highlightLum < 0.5) textColor = pal.main;
                      else if (mainLum > 0.7) textColor = '#222';
                      else if (mainLum < 0.3) textColor = '#fff';
                      return (
                        <button
                          key={preset.name}
                          className="dropdown-option"
                          style={{
                            width: '100%',
                            padding: '8px 16px',
                            cursor: 'pointer',
                            background: pal.main,
                            color: textColor,
                            border: 'none',
                            textAlign: 'left',
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            transition: 'all 0.2s ease',
                          }}
                          onClick={() => handleApplyPreset(preset.name)}
                        >
                          {preset.name}
                        </button>
                      );
                    })}
                    <button
                      className="dropdown-option"
                      style={{
                        width: '100%',
                        padding: '8px 16px',
                        cursor: 'pointer',
                        background: 'linear-gradient(90deg, #6C1CD1 0%, #4361EE 33%, #00FF99 66%, #FF1B1B 100%)',
                        color: '#fff',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        transition: 'all 0.2s ease',
                        borderTop: '1px solid rgba(255,255,255,0.2)',
                      }}
                      onClick={() => { setCustomPaletteOpen(true); setAppearanceDropdown(false); }}
                    >
                      Custom…
                    </button>
                  </div>
                )}
              </div>
              <button 
                onClick={() => { setTourStep(0); setIsTourOpen(true); localStorage.setItem('tonnext-visited', 'true'); }}
                className="blend-btn header-btn tour-btn"
                title="Start guided tour (Ctrl+T)"
                aria-label="Start guided tour"
              >
                <svg className="tour-icon" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
                </svg>
              </button>
              <button
                className="blend-btn header-btn options-btn"
                title="Settings"
                aria-label="Settings"
                onClick={() => setIsSettingsOpen(true)}
              >
                <SettingsIcon className="playback-icon" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Header Container - only visible on mobile */}
        <div className="mobile-header-container show-on-mobile" style={{ 
          background: 'var(--color-main)', 
          height: 'calc(var(--header-footer-height) * 2)', 
          minHeight: 'calc(var(--header-footer-height) * 2)',
          display: 'none'
        }}>
          {/* Mobile Row 1: Title and Buttons */}
          <div className="mobile-header-row" style={{ 
            height: 'var(--header-footer-height)', 
            minHeight: 'var(--header-footer-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: '0.5rem',
            paddingRight: '0.5rem'
          }}>
            <h1 
              ref={mobileTitleRef}
              className="blend-btn tonnext-title" 
              aria-label="Tonnext Home"
              onMouseEnter={() => {
                setHoveredTitle('mobile');
                if (mobileTitleRef.current) setMobileTitleRect(mobileTitleRef.current.getBoundingClientRect());
              }}
              onMouseLeave={() => {
                setHoveredTitle(null);
              }}
              style={{ cursor: 'pointer' }}
              title="Hover for acknowledgments"
            >
              Tonnext
            </h1>
            <div className="header-buttons flex items-center flex-shrink-0">
              <div
                className="relative"
                onMouseEnter={() => {
                  if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
                  setAppearanceDropdown(true);
                }}
                onMouseLeave={() => {
                  if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
                  dropdownTimeout.current = setTimeout(() => setAppearanceDropdown(false), 200);
                }}
              >
                <button
                  ref={appearanceBtnRef}
                  className="blend-btn header-btn theme-btn"
                  aria-haspopup="true"
                  aria-expanded={appearanceDropdown}
                  data-tour="appearance"
                  title="Theme Settings"
                  aria-label="Theme Settings"
                >
                  <svg className="theme-icon" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                  </svg>
                </button>
                {appearanceDropdown && (
                  <div
                    className="dropdown-menu"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 1000,
                      background: 'var(--color-main)',
                      color: '#fff',
                      border: '2px solid var(--color-highlight)',
                      borderTop: 'none',
                      borderRadius: '0 0 8px 8px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      minWidth: 200,
                      fontSize: '1rem',
                      padding: 0,
                    }}
                  >
                    {PALETTE_PRESETS.map(preset => {
                      const pal = PALETTE_PREVIEW[preset.name as keyof typeof PALETTE_PREVIEW];
                      // Contrast: if main is dark, use highlight for text; if highlight is dark, use main for text; else fallback to white/black
                      const getLuminance = (hex: string) => {
                        const c = hex.replace('#', '');
                        if (c.length !== 6) return 1;
                        const r = parseInt(c.slice(0, 2), 16) / 255;
                        const g = parseInt(c.slice(2, 4), 16) / 255;
                        const b = parseInt(c.slice(4, 6), 16) / 255;
                        return 0.299 * r + 0.587 * g + 0.114 * b;
                      };
                      const mainLum = getLuminance(pal.main);
                      const highlightLum = getLuminance(pal.highlight);
                      let textColor = '#fff';
                      if (preset.name === 'Cinnabar') textColor = '#fff';
                      else if (mainLum < 0.5 && highlightLum > 0.5) textColor = pal.highlight;
                      else if (mainLum > 0.5 && highlightLum < 0.5) textColor = pal.main;
                      else if (mainLum > 0.7) textColor = '#222';
                      else if (mainLum < 0.3) textColor = '#fff';
                      return (
                        <button
                          key={preset.name}
                          className="dropdown-option"
                          style={{
                            width: '100%',
                            padding: '8px 16px',
                            cursor: 'pointer',
                            background: pal.main,
                            color: textColor,
                            border: 'none',
                            textAlign: 'left',
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            transition: 'all 0.2s ease',
                          }}
                          onClick={() => handleApplyPreset(preset.name)}
                        >
                          {preset.name}
                        </button>
                      );
                    })}
                    <button
                      className="dropdown-option"
                      style={{
                        width: '100%',
                        padding: '8px 16px',
                        cursor: 'pointer',
                        background: 'linear-gradient(90deg, #6C1CD1 0%, #4361EE 33%, #00FF99 66%, #FF1B1B 100%)',
                        color: '#fff',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        transition: 'all 0.2s ease',
                        borderTop: '1px solid rgba(255,255,255,0.2)',
                      }}
                      onClick={() => { setCustomPaletteOpen(true); setAppearanceDropdown(false); }}
                    >
                      Custom…
                    </button>
                  </div>
                )}
              </div>
              <button 
                onClick={() => { setTourStep(0); setIsTourOpen(true); localStorage.setItem('tonnext-visited', 'true'); }}
                className="blend-btn header-btn tour-btn"
                title="Start guided tour (Ctrl+T)"
                aria-label="Start guided tour"
              >
                <svg className="tour-icon" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
                </svg>
              </button>
              <button
                className="blend-btn header-btn options-btn"
                title="Settings"
                aria-label="Settings"
                onClick={() => setIsSettingsOpen(true)}
              >
                <SettingsIcon className="playback-icon" />
              </button>
            </div>
          </div>
          
          {/* Mobile Row 2: MIDI Player */}
          <div className="mobile-header-row" style={{ 
            height: 'var(--header-footer-height)', 
            minHeight: 'var(--header-footer-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: '0.5rem',
            paddingRight: '0.5rem'
          }}>
            <div className="midi-controller-container flex-shrink-0" data-tour="midi-player" aria-label="MIDI Player Controls">
              <MidiPlayerCompact canvasRef={canvasRef} mode={mode} chordType={chordType} />
            </div>
          </div>
        </div>

        {/* Main Canvas - fill all available space */}
        <div
          className="flex-1 relative min-h-0"
          style={{ flex: '1 1 auto', minHeight: 0 }}
          data-tour="canvas"
          aria-label="Main Tonnetz Canvas"
        >
          <TonnextCanvas 
            mode={mode} 
            chordType={chordType}
            canvasRef={canvasRef}
          />
        </div>

        {/* Sleek Footer with Controls */}
        <footer className="hide-on-mobile" style={{ background: 'var(--color-main)', height: 'var(--header-footer-height)', minHeight: 'var(--header-footer-height)' }} data-tour="mode-controls" aria-label="Playback Mode Controls">
          <div className="max-w-7xl mx-auto flex flex-row flex-wrap items-center justify-center gap-2 h-full px-4">
            <InstrumentSelector 
              selectedInstrument={selectedInstrument} 
              onInstrumentChange={handleInstrumentChange} 
              aria-label="Instrument Selector"
            />
            <button className={`blend-btn${mode === 'note' ? ' active' : ''}`} onClick={() => setMode('note')} aria-label="Note Mode"><Music3 className="playback-icon" /></button>
            <button className={`blend-btn${mode === 'chord' ? ' active' : ''}`} onClick={() => setMode('chord')} aria-label="Chord Mode"><Music4 className="playback-icon" /></button>
            <button className={`blend-btn${mode === 'arpeggio' ? ' active' : ''}`} onClick={() => setMode('arpeggio')} aria-label="Arpeggio Mode"><ListMusic className="playback-icon" /></button>
            <ChordDropdown value={chordType} onChange={setChordType} aria-label="Chord Type Selector" />
          </div>
        </footer>

        {/* Mobile Footer Container - only visible on mobile */}
        <div className="mobile-footer-container show-on-mobile" style={{ 
          background: 'var(--color-main)', 
          height: 'calc(var(--header-footer-height) * 2)', 
          minHeight: 'calc(var(--header-footer-height) * 2)',
          display: 'none'
        }}>
          {/* Mobile Row 1: Instrument Selector and Mode Buttons */}
          <div className="mobile-footer-row" style={{ 
            height: 'var(--header-footer-height)', 
            minHeight: 'var(--header-footer-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: '0.5rem',
            paddingRight: '0.5rem'
          }}>
            <div className="max-w-7xl mx-auto flex flex-row flex-wrap items-center justify-center gap-2 h-full px-4">
              <InstrumentSelector 
                selectedInstrument={selectedInstrument} 
                onInstrumentChange={handleInstrumentChange} 
                aria-label="Instrument Selector"
              />
              <button className={`blend-btn${mode === 'note' ? ' active' : ''}`} onClick={() => setMode('note')} aria-label="Note Mode"><Music3 className="playback-icon" /></button>
              <button className={`blend-btn${mode === 'chord' ? ' active' : ''}`} onClick={() => setMode('chord')} aria-label="Chord Mode"><Music4 className="playback-icon" /></button>
              <button className={`blend-btn${mode === 'arpeggio' ? ' active' : ''}`} onClick={() => setMode('arpeggio')} aria-label="Arpeggio Mode"><ListMusic className="playback-icon" /></button>
            </div>
          </div>
          
          {/* Mobile Row 2: Chord Selector */}
          <div className="mobile-footer-row" style={{ 
            height: 'var(--header-footer-height)', 
            minHeight: 'var(--header-footer-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: '0.5rem',
            paddingRight: '0.5rem'
          }}>
            <div className="max-w-7xl mx-auto flex flex-row flex-wrap items-center justify-center gap-2 h-full px-4">
              <ChordDropdown 
                value={chordType} 
                onChange={setChordType} 
                aria-label="Chord Type Selector"
                buttonClassName="blend-btn"
                buttonStyle={{ height: '100%', minHeight: '100%', maxHeight: '100%', padding: '0 1.5em', fontSize: 'clamp(0.8rem, 1.4vw, 1rem)' }}
              />
            </div>
          </div>
        </div>

        {/* Settings Modal */}
        {isSettingsOpen && (
          <div className="export-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIsSettingsOpen(false); }}>
            <div className="export-modal-outer">
              <div className="export-modal" style={{ borderRadius: 12, maxWidth: 500, width: '95vw', paddingTop: 32, paddingBottom: 0, padding: 0, margin: 0 }}>
                <Settings
                  onClose={() => setIsSettingsOpen(false)}
                  onStartTour={() => { setTourStep(0); setIsTourOpen(true); localStorage.setItem('tonnext-visited', 'true'); }}
                />
              </div>
            </div>
          </div>
        )}

        {customPaletteOpen && (
          <CustomPaletteModal
            initialPalette={customPalette}
            onApply={handleApplyCustomPalette}
            onCancel={() => setCustomPaletteOpen(false)}
          />
        )}

        {/* Tour Component */}
        <Tour
          isOpen={isTourOpen}
          onComplete={() => setIsTourOpen(false)}
          step={tourStep}
          setStep={setTourStep}
        />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <MidiProvider>
      <HomeContent />
    </MidiProvider>
  );
}
