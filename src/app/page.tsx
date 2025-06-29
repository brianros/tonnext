'use client';

import { useState, useRef, useEffect } from 'react';
import Settings from '@/components/Settings';
import TonnextCanvas from '@/components/TonnextCanvas';
import MidiPlayerCompact from '@/components/MidiPlayerCompact';
import { MidiProvider } from '@/contexts/MidiContext';
import { useMidiPlayer } from '@/hooks/useMidiPlayer';
import CustomPaletteModal, { Palette } from '@/components/CustomPaletteModal';
// import Controls from '@/components/Controls'; // No longer used

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

function HomeContent() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mode, setMode] = useState<'note' | 'chord' | 'arpeggio'>('note');
  const [chordType, setChordType] = useState<string>('major');
  const [appearanceDropdown, setAppearanceDropdown] = useState(false);
  const appearanceBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownTimeout = useRef<NodeJS.Timeout | null>(null);
  const [chordDropdownOpen, setChordDropdownOpen] = useState(false);
  const chordDropdownRef = useRef<HTMLDivElement>(null);
  const [customPaletteOpen, setCustomPaletteOpen] = useState(false);
  const [customPalette, setCustomPalette] = useState<Palette>({
    main: '#DA4C2B',
    highlight: '#D4D7CB',
    accent: '#D7A798',
    hover: '#DD4A2F',
    hover2: '#DB4A2F',
  });

  // Initialize MIDI player to ensure shared state
  useMidiPlayer();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (chordDropdownRef.current && !chordDropdownRef.current.contains(event.target as Node)) {
        setChordDropdownOpen(false);
      }
    }
    if (chordDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [chordDropdownOpen]);

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

  return (
    <div className="h-screen flex flex-col" style={{ height: '100vh' }}>
      {/* Sleek Header */}
      <header className="" style={{ background: 'var(--color-main)', height: '56px', minHeight: '56px' }}>
        <div className="max-w-7xl mx-auto flex items-center h-full justify-between relative">
          <div className="flex items-center space-x-4 flex-shrink-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-white flex-shrink-0">Tonnext</h1>
            <div className="flex-shrink-0">
              <MidiPlayerCompact />
            </div>
          </div>
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
              >
                Appearance
              </button>
              {appearanceDropdown && (
                <div
                  className="absolute left-0 rounded shadow-lg z-50 border border-white"
                  style={{
                    minWidth: 200,
                    background: 'var(--color-main)',
                    color: '#fff',
                    fontSize: '2rem',
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
            <button onClick={() => setIsSettingsOpen(true)} className="blend-btn">Help</button>
          </div>
        </div>
      </header>

      {/* Main Canvas - fill all available space */}
      <div
        className="flex-1 relative min-h-0"
        style={{ height: 'calc(100vh - 56px - 64px)' }}
      >
        <TonnextCanvas 
          mode={mode} 
          chordType={chordType}
        />
      </div>

      {/* Sleek Footer with Controls */}
      <footer style={{ background: 'var(--color-main)', height: '64px', minHeight: '64px' }}>
        <div className="max-w-7xl mx-auto flex flex-row items-center justify-center gap-6 h-full">
          <button className={`blend-btn${mode === 'note' ? ' active' : ''}`} onClick={() => setMode('note')}>Note</button>
          <button className={`blend-btn${mode === 'chord' ? ' active' : ''}`} onClick={() => setMode('chord')}>Chord</button>
          <button className={`blend-btn${mode === 'arpeggio' ? ' active' : ''}`} onClick={() => setMode('arpeggio')}>Arpeggio</button>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              className={`blend-btn${chordDropdownOpen ? ' active' : ''}`}
              style={{
                minWidth: 336,
                maxWidth: 399,
                width: 437,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                verticalAlign: 'middle',
                lineHeight: 1,
              }}
              onClick={() => setChordDropdownOpen((open) => !open)}
              type="button"
            >
              <span
                style={{
                  flex: '1 1 auto',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                  lineHeight: 1,
                  textAlign: 'left'
                }}
              >
                {CHORD_TYPES.find(opt => opt.value === chordType)?.label || 'Select Chord'}
              </span>
              <span
                style={{
                  flex: '0 0 auto',
                  marginLeft: 8,
                  fontSize: '1.2rem',
                  lineHeight: 1,
                  alignSelf: 'center'
                }}
              >
                ▲
              </span>
            </button>
            {chordDropdownOpen && (
              <div
                ref={chordDropdownRef}
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: '100%',
                  top: 'auto',
                  zIndex: 100,
                  background: 'var(--color-main)',
                  color: '#fff',
                  minWidth: 280,
                  maxWidth: 333,
                  width: 364,
                  border: '1px solid var(--color-highlight)',
                  borderRadius: 6,
                  marginBottom: 4,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  maxHeight: 220,
                  overflowY: 'auto',
                }}
              >
                {CHORD_TYPES.map(opt => (
                  <div
                    key={opt.value}
                    onClick={() => { setChordType(opt.value); setChordDropdownOpen(false); }}
                    style={{
                      padding: '0.4em 1em',
                      cursor: 'pointer',
                      background: chordType === opt.value ? 'var(--color-highlight)' : 'var(--color-main)',
                      color: chordType === opt.value ? 'var(--color-main)' : '#fff',
                      borderBottom: '1px solid var(--color-highlight)',
                      transition: 'background 0.2s, color 0.2s',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 294,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-highlight)', e.currentTarget.style.color = 'var(--color-main)')}
                    onMouseLeave={e => (e.currentTarget.style.background = chordType === opt.value ? 'var(--color-highlight)' : 'var(--color-main)', e.currentTarget.style.color = chordType === opt.value ? 'var(--color-main)' : '#fff')}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
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
