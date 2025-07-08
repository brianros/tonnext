'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Piano, Guitar, Music, Mic, Heart, Sun, Flame, Dice6, Zap } from 'lucide-react';

export interface Instrument {
  id: string;
  name: string;
  category: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  toneType: 'synth' | 'sampler' | 'instrument' | 'random';
  toneOptions?: unknown;
}

const INSTRUMENTS: Instrument[] = [
  // Piano & Keys
  { id: 'piano', name: 'Piano', category: 'Keys', icon: Piano, toneType: 'synth', toneOptions: { oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 } } },
  
  // Strings
  { id: 'violin', name: 'Violin', category: 'Strings', icon: Music, toneType: 'synth', toneOptions: { oscillator: { type: 'sine' }, envelope: { attack: 0.05, decay: 0.3, sustain: 0.5, release: 1.8 } } },
  
  // Woodwind
  { id: 'flute', name: 'Flute', category: 'Woodwind', icon: Mic, toneType: 'synth', toneOptions: { oscillator: { type: 'sine' }, envelope: { attack: 0.1, decay: 0.3, sustain: 0.5, release: 1.2 } } },
  
  // Guitar
  { id: 'electric-guitar', name: 'Electric Guitar', category: 'Guitar', icon: Guitar, toneType: 'synth', toneOptions: { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.2, release: 0.6 } } },
  
  // Synth & Electronic
  { id: 'organ', name: 'Organ', category: 'Synth', icon: Sun, toneType: 'synth', toneOptions: { oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.1 } } },
  { id: 'warm', name: 'Warm', category: 'Synth', icon: Heart, toneType: 'synth', toneOptions: { oscillator: { type: 'triangle' }, envelope: { attack: 0.1, decay: 0.2, sustain: 0.6, release: 1.5 } } },
  { id: 'bright', name: 'Bright', category: 'Synth', icon: Flame, toneType: 'synth', toneOptions: { oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.05, sustain: 0.1, release: 0.3 } } },
  { id: 'electric', name: 'Electric', category: 'Synth', icon: Zap, toneType: 'synth', toneOptions: { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.5 } } },
  
  // Random
  { id: 'random', name: 'Random', category: 'Random', icon: Dice6, toneType: 'random', toneOptions: {} },
];

interface InstrumentSelectorProps {
  selectedInstrument: Instrument;
  onInstrumentChange: (instrument: Instrument) => void;
}

export default function InstrumentSelector({ selectedInstrument, onInstrumentChange }: InstrumentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150); // Small delay to prevent accidental closing
  };

  const handleInstrumentSelect = (instrument: Instrument) => {
    console.log('Instrument selected:', instrument.name);
    
    // For random instrument, create a new random instrument each time
    if (instrument.toneType === 'random') {
      const randomInstruments = [
        // Piano-like
        { oscillator: { type: 'triangle' as const }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 } },
        { oscillator: { type: 'square' as const }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.8 } },
        // String-like
        { oscillator: { type: 'sine' as const }, envelope: { attack: 0.1, decay: 0.2, sustain: 0.6, release: 2 } },
        { oscillator: { type: 'sine' as const }, envelope: { attack: 0.05, decay: 0.3, sustain: 0.5, release: 1.8 } },
        // Woodwind-like
        { oscillator: { type: 'sine' as const }, envelope: { attack: 0.1, decay: 0.3, sustain: 0.5, release: 1.2 } },
        { oscillator: { type: 'sine' as const }, envelope: { attack: 0.08, decay: 0.2, sustain: 0.4, release: 1.0 } },
        // Guitar-like
        { oscillator: { type: 'sawtooth' as const }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.2, release: 0.6 } },
        // Synth-like
        { oscillator: { type: 'square' as const }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.1 } },
        { oscillator: { type: 'triangle' as const }, envelope: { attack: 0.1, decay: 0.2, sustain: 0.6, release: 1.5 } },
        { oscillator: { type: 'square' as const }, envelope: { attack: 0.01, decay: 0.05, sustain: 0.1, release: 0.3 } },
        // Experimental
        { oscillator: { type: 'sawtooth' as const }, envelope: { attack: 0.05, decay: 0.1, sustain: 0.4, release: 1.5 } },
        { oscillator: { type: 'triangle' as const }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.7, release: 0.8 } },
      ];
      
      const randomIndex = Math.floor(Math.random() * randomInstruments.length);
      const randomSettings = randomInstruments[randomIndex];
      
      // Create a new random instrument with the selected settings
      const randomInstrument: Instrument = {
        ...instrument,
        toneOptions: randomSettings,
        name: `Random ${randomIndex + 1}`,
      };
      
      console.log('Generated random instrument:', randomInstrument.name, randomSettings);
      onInstrumentChange(randomInstrument);
    } else {
      onInstrumentChange(instrument);
    }
    
    setIsOpen(false);
  };

  return (
    <div 
      className="relative" 
      ref={dropdownRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className="blend-btn"
        style={{ 
          minWidth: '120px', 
          width: '120px', 
          paddingLeft: 16, 
          paddingRight: 16,
          height: '64px',
          fontSize: 'clamp(1rem, 2vw, 1.6rem)',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
        title={selectedInstrument.name}
      >
        <span style={{ flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center' }}>
          <selectedInstrument.icon size={18} />
        </span>
        <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>▲</span>
      </button>
      
      {isOpen && (
        <div
          className="instrument-selector-dropdown"
          style={{
            position: 'absolute',
            left: 0,
            bottom: '100%',
            zIndex: 1000,
            background: 'var(--color-main)',
            color: '#fff',
            minWidth: '100%',
            maxWidth: '100%',
            width: '100%',
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
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 0,
            boxSizing: 'border-box',
          }}
          role="listbox"
        >
          {INSTRUMENTS.map((instrument) => (
            <div
              key={instrument.id}
              role="option"
              aria-selected={selectedInstrument.id === instrument.id}
              tabIndex={0}
              onClick={() => handleInstrumentSelect(instrument)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { handleInstrumentSelect(instrument); }}}
              style={{
                padding: '0.15em 0.7em',
                cursor: 'pointer',
                background: selectedInstrument.id === instrument.id ? 'var(--color-highlight)' : 'var(--color-main)',
                color: selectedInstrument.id === instrument.id ? 'var(--color-main)' : '#fff',
                border: 'none',
                transition: 'background 0.2s, color 0.2s',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
                boxSizing: 'border-box',
                fontSize: '0.85rem',
                minHeight: undefined,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              className="blend-btn"
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-highlight)'; e.currentTarget.style.color = 'var(--color-main)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = selectedInstrument.id === instrument.id ? 'var(--color-highlight)' : 'var(--color-main)'; e.currentTarget.style.color = selectedInstrument.id === instrument.id ? 'var(--color-main)' : '#fff'; }}
              title={instrument.name}
            >
              <div style={{ width: '80%', height: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <instrument.icon size={32} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 