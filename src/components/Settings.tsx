'use client';

import { useState } from 'react';

interface SettingsProps {
  onClose: () => void;
  onStartTour?: () => void;
}

const DEFAULT_PALETTE = {
  main: '#DA4C2B',
  highlight: '#D4D7CB',
  accent: '#D7A798',
  hover: '#DD4A2F',
  hover2: '#DB4A2F',
};

const PALETTE_PRESETS = [
  {
    name: 'Cinnabar',
    colors: {
      main: '#DA4C2B',
      highlight: '#D4D7CB',
      accent: '#D7A798',
      hover: '#DD4A2F',
      hover2: '#DB4A2F',
    },
  },
  {
    name: 'Aurora',
    colors: {
      main: '#1A535C',
      highlight: '#F7FFF7',
      accent: '#FF6B6B',
      hover: '#4ECDC4',
      hover2: '#FFE66D',
    },
  },
  {
    name: 'Retro Pop',
    colors: {
      main: '#22223B',
      highlight: '#F2E9E4',
      accent: '#9A8C98',
      hover: '#C9ADA7',
      hover2: '#4A4E69',
    },
  },
  {
    name: 'Citrus Fresh',
    colors: {
      main: '#F9DC5C',
      highlight: '#FAFAFA',
      accent: '#F76C6C',
      hover: '#374785',
      hover2: '#24305E',
    },
  },
  {
    name: 'Forest Haze',
    colors: {
      main: '#386641',
      highlight: '#F2E8CF',
      accent: '#A7C957',
      hover: '#6A994E',
      hover2: '#BC4749',
    },
  },
  {
    name: 'Neon Night',
    colors: {
      main: '#22223B',
      highlight: '#F7F7FF',
      accent: '#9D4EDD',
      hover: '#F72585',
      hover2: '#4361EE',
    },
  },
];

export default function Settings({ onClose, onStartTour }: SettingsProps) {
  const [palette, setPalette] = useState(DEFAULT_PALETTE);

  const handlePaletteChange = (key: keyof typeof DEFAULT_PALETTE, value: string) => {
    setPalette(p => {
      const next = { ...p, [key]: value };
      document.documentElement.style.setProperty(`--color-${key}`, value);
      return next;
    });
  };

  const handlePreset = (preset: typeof PALETTE_PRESETS[number]['colors']) => {
    setPalette(preset);
    Object.entries(preset).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--color-${key}`, value);
    });
  };

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Settings</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>
      
      {/* Tour Section */}
      {onStartTour && (
        <div className="settings-panel__tour">
          <h4 className="settings-panel__tour-title">Getting Started</h4>
          <p className="settings-panel__tour-desc">
            New to Tonnext? Take a guided tour to learn about all the features and how to use them effectively.
          </p>
          <button
            onClick={() => { onStartTour(); onClose(); }}
            className="settings-panel__tour-btn"
          >
            Start Tour
          </button>
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Color Palette
          </label>
          <div className="grid grid-cols-2 gap-x-2 gap-y-2 items-center">
            <span className="text-gray-200">Main</span>
            <input type="color" value={palette.main} onChange={e => handlePaletteChange('main', e.target.value)} />
            <span className="text-gray-200">Highlight</span>
            <input type="color" value={palette.highlight} onChange={e => handlePaletteChange('highlight', e.target.value)} />
            <span className="text-gray-200">Accent</span>
            <input type="color" value={palette.accent} onChange={e => handlePaletteChange('accent', e.target.value)} />
            <span className="text-gray-200">Hover</span>
            <input type="color" value={palette.hover} onChange={e => handlePaletteChange('hover', e.target.value)} />
            <span className="text-gray-200">Hover2</span>
            <input type="color" value={palette.hover2} onChange={e => handlePaletteChange('hover2', e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
} 