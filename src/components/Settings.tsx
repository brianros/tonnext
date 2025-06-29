'use client';

import { useState } from 'react';

interface SettingsProps {
  onClose: () => void;
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

export default function Settings({ onClose }: SettingsProps) {
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
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Palette Presets
          </label>
          <div className="space-y-2">
            {PALETTE_PRESETS.map((preset, i) => (
              <button
                key={preset.name}
                className="flex items-center space-x-2 w-full rounded border border-gray-500 hover:border-white p-1 mb-1"
                style={{ background: palette.main === preset.colors.main ? '#222' : 'transparent' }}
                onClick={() => handlePreset(preset.colors)}
              >
                <span className="w-20 text-left text-white text-xs font-bold">{preset.name}</span>
                {Object.values(preset.colors).map((color, j) => (
                  <span key={j} className="inline-block w-6 h-6 rounded" style={{ background: color, border: '1px solid #333' }} />
                ))}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Color Palette
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center space-x-2">
              <span className="text-gray-200 w-20">Main</span>
              <input type="color" value={palette.main} onChange={e => handlePaletteChange('main', e.target.value)} />
            </label>
            <label className="flex items-center space-x-2">
              <span className="text-gray-200 w-20">Highlight</span>
              <input type="color" value={palette.highlight} onChange={e => handlePaletteChange('highlight', e.target.value)} />
            </label>
            <label className="flex items-center space-x-2">
              <span className="text-gray-200 w-20">Accent</span>
              <input type="color" value={palette.accent} onChange={e => handlePaletteChange('accent', e.target.value)} />
            </label>
            <label className="flex items-center space-x-2">
              <span className="text-gray-200 w-20">Hover</span>
              <input type="color" value={palette.hover} onChange={e => handlePaletteChange('hover', e.target.value)} />
            </label>
            <label className="flex items-center space-x-2">
              <span className="text-gray-200 w-20">Hover2</span>
              <input type="color" value={palette.hover2} onChange={e => handlePaletteChange('hover2', e.target.value)} />
            </label>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Layout
          </label>
          <div className="space-x-4">
            <label className="inline-flex items-center">
              <input type="radio" name="layout" value="riemann" defaultChecked className="mr-2" />
              <span className="text-gray-300">Riemannian</span>
            </label>
            <label className="inline-flex items-center">
              <input type="radio" name="layout" value="sonome" className="mr-2" />
              <span className="text-gray-300">Sonome</span>
            </label>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Show/Hide
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input type="checkbox" defaultChecked className="mr-2" />
              <span className="text-gray-300">Tone names</span>
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span className="text-gray-300">Triad names</span>
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span className="text-gray-300">Unit cell</span>
            </label>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Ghost tone duration (ms)
          </label>
          <input
            type="number"
            min="0"
            step="50"
            defaultValue="500"
            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white"
          />
        </div>
      </div>
    </div>
  );
} 