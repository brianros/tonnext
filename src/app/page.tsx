'use client';

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
// import Controls from '@/components/Controls'; // No longer used
import React from 'react';

const CHORD_TYPES = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'diminished', label: 'Diminished' },
  { value: 'augmented', label: 'Augmented' },
  { value: 'sus2', label: 'Suspended 2nd (sus2)' },
  { value: 'sus4', label: 'Suspended 4th (sus4)' },
  { value: 'major6', label: 'Major 6th' },
  { value: 'minor6', label: 'Minor 6th' },
  { value: 'major7', label: 'Major 7th' },
  { value: 'minor7', label: 'Minor 7th' },
  { value: 'dominant7', label: 'Dominant 7th' },
  { value: 'diminished7', label: 'Diminished 7th' },
  { value: 'half-diminished7', label: 'Half-diminished 7th (m7♭5)' },
  { value: 'minorMajor7', label: 'Minor Major 7th' },
  { value: 'augmented7', label: 'Augmented 7th' },
  { value: '7b5', label: '7th Flat 5 (7♭5)' },
  { value: '7#5', label: '7th Sharp 5 (7♯5)' },
  { value: 'add9', label: 'Add 9' },
  { value: 'madd9', label: 'Minor Add 9' },
  { value: 'add11', label: 'Add 11' },
  { value: 'add13', label: 'Add 13' },
  { value: 'm7b5', label: 'Minor 7th Flat 5 (m7♭5)' },
  { value: 'sus2_7', label: 'Sus2 7th' },
  { value: 'sus4_7', label: 'Sus4 7th' },
];

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
    main: '#1A535C', highlight: '#F7FFF7', accent: '#FF6B6B', hover: '#4ECDC4', hover2: '#FFE66D',
  },
  'Retro Pop': {
    main: '#22223B', highlight: '#F2E9E4', accent: '#9A8C98', hover: '#C9ADA7', hover2: '#4A4E69',
  },
  'Forest Haze': {
    main: '#386641', highlight: '#F2E8CF', accent: '#A7C957', hover: '#6A994E', hover2: '#BC4749',
  },
  'Neon Night': {
    main: '#6C1CD1', highlight: '#F7F7FF', accent: '#9D4EDD', hover: '#F72585', hover2: '#4361EE',
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
  const [mode, setMode] = useState<'note' | 'chord' | 'arpeggio'>('arpeggio');
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
    toneType: 'synth',
    toneOptions: { oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 } }
  });
  
  // Canvas ref for export functionality
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Tour state
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // Loading overlay demo state
  const [loading, setLoading] = useState(true);
  const [spinLoadingLogo, setSpinLoadingLogo] = useState(false);
  const [showLoadingLogo, setShowLoadingLogo] = useState(true);

  const [logoTooltipOpen, setLogoTooltipOpen] = useState(false);
  const logoTooltipTimeout = useRef<NodeJS.Timeout | null>(null);
  const [titleHovered, setTitleHovered] = useState(false);

  // Add state for dropdown
  const [tonnextDropdownOpen, setTonnextDropdownOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000); // back to normal
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading) {
      setSpinLoadingLogo(true);
    }
  }, [loading]);

  // Launch tour on first load (after logo is gone)
  useEffect(() => {
    if (!showLoadingLogo && !localStorage.getItem('tonnext-visited')) {
      setTimeout(() => {
        setTourStep(0);
        setIsTourOpen(true);
        localStorage.setItem('tonnext-visited', 'true');
      }, 300);
    }
  }, [showLoadingLogo]);

  const handleLoadingLogoFinish = () => {
    setShowLoadingLogo(false);
  };

  // Initialize MIDI player to ensure shared state
  useMidiPlayer();
  
  // Get MIDI context for instrument updates
  const { setSelectedInstrument: setContextInstrument, getMidiPlayerFunctions } = useMidiContext();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+T or Cmd+T to start tour
      if ((event.ctrlKey || event.metaKey) && event.key === 't') {
        event.preventDefault();
        if (!isTourOpen && !loading) {
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
          setTitleHovered(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isTourOpen, loading, tonnextDropdownOpen]);

  // Handler to apply a palette preset by name (delegates to Settings logic)
  const handleApplyPreset = (name: string) => {
    // Find the preset in Settings.tsx (must keep in sync)
    const preset = {
      'Cinnabar': {
        main: '#DA4C2B', highlight: '#D4D7CB', accent: '#D7A798', hover: '#DD4A2F', hover2: '#DB4A2F',
      },
      'Aurora': {
        main: '#1A535C', highlight: '#F7FFF7', accent: '#FF6B6B', hover: '#4ECDC4', hover2: '#FFE66D',
      },
      'Retro Pop': {
        main: '#22223B', highlight: '#F2E9E4', accent: '#9A8C98', hover: '#C9ADA7', hover2: '#4A4E69',
      },
      'Forest Haze': {
        main: '#386641', highlight: '#F2E8CF', accent: '#A7C957', hover: '#6A994E', hover2: '#BC4749',
      },
      'Neon Night': {
        main: '#6C1CD1', highlight: '#F7F7FF', accent: '#9D4EDD', hover: '#F72585', hover2: '#4361EE',
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
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    }
    setVh();
    window.addEventListener('resize', setVh);
    return () => window.removeEventListener('resize', setVh);
  }, []);

  function ChordDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [menuWidth, setMenuWidth] = useState<number | undefined>(undefined);

    // Set menu width to match button width when open
    useEffect(() => {
      if (open && btnRef.current) {
        setMenuWidth(btnRef.current.offsetWidth);
      }
    }, [open]);

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
      <div
        style={{ position: 'relative' }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          ref={btnRef}
          className="blend-btn"
          style={{
            width: 'auto',
            height: '64px',
            fontSize: 'clamp(1rem, 2vw, 1.6rem)',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            background: open ? 'var(--color-highlight)' : undefined,
            color: open ? 'var(--color-main)' : undefined,
            outline: open ? '2px solid var(--color-highlight)' : undefined,
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          tabIndex={0}
        >
          <span style={{ flex: 1, textAlign: 'left' }}>{selectedLabel || 'Select Chord'}</span>
          <span style={{ marginLeft: 8, fontSize: '1.2rem', lineHeight: 1 }}>▲</span>
        </button>
        {open && (
          <div
            ref={menuRef}
            className="custom-chord-dropdown"
            style={{
              position: 'absolute',
              left: 0,
              bottom: '100%',
              zIndex: 1000,
              background: 'var(--color-main)',
              color: '#fff',
              minWidth: menuWidth ? menuWidth : '100%',
              maxWidth: menuWidth ? menuWidth : '100%',
              width: menuWidth ? menuWidth : '100%',
              border: 'none',
              borderRadius: 0,
              marginBottom: 0,
              boxShadow: 'none',
              fontSize: '0.85rem',
              fontWeight: 500,
              textTransform: 'uppercase',
              maxHeight: 500,
              overflowY: 'auto',
              padding: 0,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0,
              boxSizing: 'border-box',
            }}
            role="listbox"
          >
            {CHORD_GROUPS.map(group => (
              <React.Fragment key={group.label}>
                <div className="chord-group-header" style={{ gridColumn: '1 / span 2', padding: '0.3em 1em', fontWeight: 'bold', color: 'var(--color-accent)', background: 'rgba(0,0,0,0.08)', border: 'none', fontSize: '0.95em' }}>{group.label}</div>
                {group.options.map(opt => (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={value === opt.value}
                    tabIndex={0}
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { onChange(opt.value); setOpen(false); }}}
                    style={{
                      padding: '2px 0.7em',
                      cursor: 'pointer',
                      background: value === opt.value ? 'var(--color-highlight)' : 'var(--color-main)',
                      color: value === opt.value ? 'var(--color-main)' : '#fff',
                      border: 'none',
                      transition: 'background 0.2s, color 0.2s',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      width: '100%',
                      boxSizing: 'border-box',
                      fontSize: '0.85rem',
                      minHeight: undefined,
                    }}
                    className="blend-btn chord-option"
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-highlight)'; e.currentTarget.style.color = 'var(--color-main)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = value === opt.value ? 'var(--color-highlight)' : 'var(--color-main)'; e.currentTarget.style.color = value === opt.value ? 'var(--color-main)' : '#fff'; }}
                  >
                    {opt.label}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ height: 'calc(var(--vh, 1vh) * 100)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {showLoadingLogo && (
        <LoadingLogo spin={spinLoadingLogo} onFinish={handleLoadingLogoFinish} />
      )}
      <div className="main-content" style={{
        filter: loading ? 'blur(6px) brightness(0.7)' : 'none',
        transition: 'filter 0.3s',
        pointerEvents: loading ? 'none' : 'auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Sleek Header */}
        <header className="" style={{ background: 'var(--color-main)', height: 'var(--header-footer-height)', minHeight: 'var(--header-footer-height)', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="max-w-7xl mx-auto flex items-center h-full justify-between relative">
            {/* Tonnext logo/title container */}
            <div className="flex items-center space-x-4 flex-shrink-0">
              <div
                style={{ display: 'flex', alignItems: 'center', position: 'relative', height: '64px', minWidth: '148px', cursor: 'pointer', padding: 0 }}
                onMouseEnter={() => {
                  setTonnextDropdownOpen(true);
                  setTitleHovered(true);
                }}
                onMouseLeave={(e) => {
                  // Check if we're moving to the dropdown
                  const relatedTarget = e.relatedTarget as HTMLElement;
                  if (!relatedTarget || !relatedTarget.closest('.tonnext-dropdown')) {
                    setTonnextDropdownOpen(false);
                    setTitleHovered(false);
                  }
                }}
                onTouchStart={() => setTonnextDropdownOpen(v => !v)}
                tabIndex={0}
                aria-label="Tonnetz Acknowledgements"
              >
                <div style={{ position: 'relative', width: '116px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}>
                  <h1 
                    className="blend-btn tonnext-title" 
                    style={{
                      margin: 0, 
                      padding: '0 1rem', 
                      height: '64px', 
                      width: '116px',
                      textTransform: 'none', 
                      alignItems: 'center',
                      display: 'flex',
                      transition: 'opacity 0.7s',
                      opacity: titleHovered ? 0 : 1,
                      pointerEvents: 'none',
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      zIndex: 1,
                      justifyContent: 'center',
                    }}
                  >
                    Ton
                    <span id="tonnext-second-n" style={{ position: 'relative', display: 'inline-block' }}>n</span>ext
                  </h1>
                  <span 
                    className="tonnext-logo" 
                    style={{
                      height: '48px',
                      width: '48px',
                      position: 'absolute',
                      transition: 'opacity 0.7s',
                      opacity: titleHovered ? 1 : 0,
                      pointerEvents: 'none',
                      zIndex: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      left: '0',
                      top: '0',
                    }}
                    ref={el => {
                      if (el && titleHovered) {
                        const nSpan = document.getElementById('tonnext-second-n');
                        if (nSpan) {
                          const nRect = nSpan.getBoundingClientRect();
                          const parentRect = el.parentElement?.getBoundingClientRect();
                          if (parentRect) {
                            const offsetLeft = nRect.left - parentRect.left + nRect.width / 2 - 24; // 24 = logo radius
                            el.style.left = `${offsetLeft}px`;
                            el.style.top = `${nRect.top - parentRect.top + nRect.height / 2 - 24}px`;
                          }
                        }
                      }
                    }}
                  >
                    <svg viewBox="0 0 124 124" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <polygon points="62,18 110,102 14,102" fill="none" stroke="var(--color-accent)" stroke-width="3" />
                      <circle cx="62" cy="18" r="12" fill="var(--color-accent)" />
                      <circle cx="110" cy="102" r="12" fill="var(--color-accent)" />
                      <circle cx="14" cy="102" r="12" fill="var(--color-accent)" />
                    </svg>
                  </span>
                </div>
                {tonnextDropdownOpen && (
                  <div
                    className="tonnext-dropdown"
                    onMouseEnter={() => {
                      setTonnextDropdownOpen(true);
                      setTitleHovered(true);
                    }}
                    onMouseLeave={() => {
                      setTonnextDropdownOpen(false);
                      setTitleHovered(false);
                    }}
                    ref={el => {
                      if (el) {
                        const rect = el.getBoundingClientRect();
                        const vw = window.innerWidth;
                        // If the dropdown would overflow right, shift it left
                        if (rect.right > vw - 8) {
                          const overflow = rect.right - (vw - 8);
                          el.style.left = `-${overflow}px`;
                        } else {
                          el.style.left = '0';
                        }
                      }
                    }}
                  >
                    <div style={{fontWeight: 'bold', marginBottom: 6, color: 'var(--color-accent)'}}>Tonnetz Acknowledgements</div>
                    <div style={{marginBottom: 8, color: 'var(--color-highlight)'}}>
                      Tonnext is an interactive tool for exploring music and harmony through geometric visualization.
                    </div>
                    <div style={{marginBottom: 8}}>
                      <span style={{fontWeight: 500}}>Tonnetz</span> is a geometric system for visualizing tonal relationships in music. <a href="https://en.wikipedia.org/wiki/Tonnetz" target="_blank" rel="noopener noreferrer" style={{color: 'var(--color-accent)', textDecoration: 'underline'}}>Learn more</a>.
                    </div>
                    <div style={{marginBottom: 6}}>
                      Visualization based on <a href="https://github.com/cifkao/tonnetz-viz" target="_blank" rel="noopener noreferrer" style={{color: 'var(--color-accent)', textDecoration: 'underline'}}>tonnetz-viz</a> by cifkao.
                    </div>
                    <div style={{fontSize: '0.95em', color: 'var(--color-highlight)'}}>Brian Rosenfeld - 2025</div>
                    <div style={{fontSize: '0.95em', color: 'var(--color-accent)'}}><a href="https://mirari.ar" target="_blank" rel="noopener noreferrer" style={{color: 'var(--color-accent)', textDecoration: 'underline'}}>mīrārī</a></div>
                  </div>
                )}
              </div>
            </div>
            {/* MIDI player container as sibling */}
            <div className="midi-controller-container flex-shrink-0" style={{ display: 'flex', alignItems: 'center', height: '64px' }}>
              <MidiPlayerCompact canvasRef={canvasRef} mode={mode} chordType={chordType} />
            </div>
            {/* Other header buttons */}
            <div className="flex space-x-2 items-center flex-shrink-0">
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
                  className="blend-btn"
                  aria-haspopup="true"
                  aria-expanded={appearanceDropdown}
                  data-tour="appearance"
                  style={{ width: '120px', height: '64px' }}
                >
                  Theme
                </button>
                {appearanceDropdown && (
                  <div
                    className="absolute left-0 rounded shadow-lg z-50 border border-white"
                    style={{
                      minWidth: 200,
                      background: 'var(--color-main)',
                      color: '#fff',
                      fontSize: '1.6rem',
                      padding: 0,
                      top: '100%',
                      left: 0,
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
                          className="blend-btn w-full text-left whitespace-nowrap"
                          style={{
                            background: pal.main,
                            border: 'none',
                            color: textColor,
                            textAlign: 'left',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            overflow: 'hidden',
                          }}
                          onClick={() => handleApplyPreset(preset.name)}
                        >
                          {preset.name}
                        </button>
                      );
                    })}
                    <button
                      className="blend-btn w-full text-left border-t border-white"
                      style={{
                        background: 'linear-gradient(90deg, #6C1CD1 0%, #4361EE 33%, #00FF99 66%, #FF1B1B 100%)',
                        border: 'none',
                        color: '#fff',
                        textAlign: 'left',
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
                className="blend-btn"
                title="Start guided tour (Ctrl+T)"
                style={{ width: '120px', height: '64px' }}
              >
                Tour
              </button>
            </div>
          </div>
        </header>

        {/* Main Canvas - fill all available space */}
        <div
          className="flex-1 relative min-h-0"
          style={{ flex: '1 1 auto', minHeight: 0 }}
          data-tour="canvas"
        >
          <TonnextCanvas 
            mode={mode} 
            chordType={chordType}
            canvasRef={canvasRef}
          />
        </div>

        {/* Sleek Footer with Controls */}
        <footer style={{ background: 'var(--color-main)', height: 'var(--header-footer-height)', minHeight: 'var(--header-footer-height)' }} data-tour="mode-controls">
          <div className="max-w-7xl mx-auto flex flex-row flex-wrap items-center justify-center gap-2 h-full px-4">
            <button className={`blend-btn${mode === 'note' ? ' active' : ''}`} onClick={() => setMode('note')}>Note</button>
            <button className={`blend-btn${mode === 'chord' ? ' active' : ''}`} onClick={() => setMode('chord')}>Chord</button>
            <button className={`blend-btn${mode === 'arpeggio' ? ' active' : ''}`} onClick={() => setMode('arpeggio')}>Arpeggio</button>
            <ChordDropdown value={chordType} onChange={setChordType} />
            <InstrumentSelector 
              selectedInstrument={selectedInstrument} 
              onInstrumentChange={handleInstrumentChange} 
            />
          </div>
        </footer>

        {/* Settings Panel */}
        {isSettingsOpen && (
          <div className="bg-gray-800 border-b border-gray-700 p-4">
            <Settings onClose={() => setIsSettingsOpen(false)} />
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
