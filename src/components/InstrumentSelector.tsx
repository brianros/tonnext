'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface Instrument {
  id: string;
  name: string;
  category: string;
  toneType: 'synth' | 'sampler' | 'instrument';
  toneOptions?: any;
}

const INSTRUMENTS: Instrument[] = [
  // Synth instruments
  { id: 'piano', name: 'Piano', category: 'Keys', toneType: 'synth', toneOptions: { oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 } } },
  { id: 'strings', name: 'Strings', category: 'Strings', toneType: 'synth', toneOptions: { oscillator: { type: 'sine' }, envelope: { attack: 0.1, decay: 0.2, sustain: 0.6, release: 2 } } },
  { id: 'brass', name: 'Brass', category: 'Brass', toneType: 'synth', toneOptions: { oscillator: { type: 'square' }, envelope: { attack: 0.05, decay: 0.1, sustain: 0.4, release: 1.5 } } },
  { id: 'flute', name: 'Flute', category: 'Woodwind', toneType: 'synth', toneOptions: { oscillator: { type: 'sine' }, envelope: { attack: 0.1, decay: 0.3, sustain: 0.5, release: 1.2 } } },
  { id: 'bass', name: 'Bass', category: 'Bass', toneType: 'synth', toneOptions: { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.8 } } },
  { id: 'pad', name: 'Pad', category: 'Synth', toneType: 'synth', toneOptions: { oscillator: { type: 'sine' }, envelope: { attack: 0.5, decay: 0.3, sustain: 0.7, release: 2 } } },
];

interface InstrumentSelectorProps {
  selectedInstrument: Instrument;
  onInstrumentChange: (instrument: Instrument) => void;
}

export default function InstrumentSelector({ selectedInstrument, onInstrumentChange }: InstrumentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleInstrumentSelect = (instrument: Instrument) => {
    console.log('Instrument selected:', instrument.name);
    onInstrumentChange(instrument);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="blend-btn flex items-center gap-2"
        style={{ minWidth: '140px' }}
      >
        <span>{selectedInstrument.name}</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="instrument-selector-dropdown">
          <div className="py-1 max-h-60 overflow-y-auto">
            {INSTRUMENTS.map((instrument) => (
              <button
                key={instrument.id}
                onClick={() => handleInstrumentSelect(instrument)}
                className={`${selectedInstrument.id === instrument.id ? 'selected' : ''}`}
              >
                <div className="font-medium">{instrument.name}</div>
                <div className="instrument-category">{instrument.category}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 