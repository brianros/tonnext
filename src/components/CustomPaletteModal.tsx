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
    <div className="custom-palette-modal__overlay">
      <div className="custom-palette-modal__container">
        <h2 className="custom-palette-modal__title">Custom Palette</h2>
        <form onSubmit={e => { e.preventDefault(); onApply(palette); }}>
          {Object.keys(palette).map((key) => (
            <div key={key} className="custom-palette-modal__row">
              <label className="custom-palette-modal__label">{colorLabels[key as keyof Palette]}</label>
              <input
                type="color"
                value={palette[key as keyof Palette]}
                onChange={e => setPalette(p => ({ ...p, [key]: e.target.value }))}
                className="custom-palette-modal__input"
              />
              <span className="custom-palette-modal__value">{palette[key as keyof Palette]}</span>
            </div>
          ))}
          <div className="custom-palette-modal__actions">
            <button type="button" onClick={onCancel} className="custom-palette-modal__btn">Cancel</button>
            <button type="submit" className="custom-palette-modal__btn custom-palette-modal__btn--apply">Apply</button>
          </div>
        </form>
      </div>
    </div>
  );
} 