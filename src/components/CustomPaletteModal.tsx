import React, { useState } from 'react';

export interface Palette {
  main: string;
  highlight: string;
  accent: string;
  hover: string;
  hover2: string;
}

interface CustomPaletteModalProps {
  initialPalette: Palette;
  onApply: (palette: Palette) => void;
  onCancel: () => void;
}

const colorLabels: { [K in keyof Palette]: string } = {
  main: 'Main',
  highlight: 'Highlight',
  accent: 'Accent',
  hover: 'Hover',
  hover2: 'Hover 2',
};

export default function CustomPaletteModal({ initialPalette, onApply, onCancel }: CustomPaletteModalProps) {
  const [palette, setPalette] = useState<Palette>(initialPalette);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.4)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: '#222',
        borderRadius: 12,
        padding: 32,
        minWidth: 340,
        boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
        color: '#fff',
      }}>
        <h2 style={{ fontSize: '2rem', marginBottom: 24 }}>Custom Palette</h2>
        <form onSubmit={e => { e.preventDefault(); onApply(palette); }}>
          {Object.keys(palette).map((key) => (
            <div key={key} style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
              <label style={{ minWidth: 90, fontWeight: 'bold', fontSize: '1.1rem' }}>{colorLabels[key as keyof Palette]}</label>
              <input
                type="color"
                value={palette[key as keyof Palette]}
                onChange={e => setPalette(p => ({ ...p, [key]: e.target.value }))}
                style={{ width: 48, height: 32, border: 'none', background: 'none' }}
              />
              <span style={{ fontFamily: 'monospace', fontSize: '1rem', marginLeft: 8 }}>{palette[key as keyof Palette]}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 32 }}>
            <button type="button" onClick={onCancel} style={{ padding: '0.5em 1.5em', fontSize: '1.1rem', borderRadius: 6, border: 'none', background: '#444', color: '#fff' }}>Cancel</button>
            <button type="submit" style={{ padding: '0.5em 1.5em', fontSize: '1.1rem', borderRadius: 6, border: 'none', background: 'var(--color-main)', color: '#fff', fontWeight: 'bold' }}>Apply</button>
          </div>
        </form>
      </div>
    </div>
  );
} 