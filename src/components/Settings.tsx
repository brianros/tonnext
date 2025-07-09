'use client';

import { useNotation } from '@/contexts/NotationContext';

interface SettingsProps {
  onClose: () => void;
  onStartTour?: () => void;
}

// const DEFAULT_PALETTE = {
//   main: '#DA4C2B',
//   highlight: '#D4D7CB',
//   accent: '#D7A798',
//   hover: '#DD4A2F',
//   hover2: '#DB4A2F',
// };

// const PALETTE_PRESETS = [
//   {
//     name: 'Cinnabar',
//     colors: {
//       main: '#DA4C2B',
//       highlight: '#D4D7CB',
//       accent: '#D7A798',
//       hover: '#DD4A2F',
//       hover2: '#DB4A2F',
//     },
//   },
//   {
//     name: 'Aurora',
//     colors: {
//       main: '#1A535C',
//       highlight: '#F7FFF7',
//       accent: '#FF6B6B',
//       hover: '#4ECDC4',
//       hover2: '#FFE66D',
//     },
//   },
//   {
//     name: 'Retro Pop',
//     colors: {
//       main: '#22223B',
//       highlight: '#F2E9E4',
//       accent: '#9A8C98',
//       hover: '#C9ADA7',
//       hover2: '#4A4E69',
//     },
//   },
//   {
//     name: 'Citrus Fresh',
//     colors: {
//       main: '#F9DC5C',
//       highlight: '#FAFAFA',
//       accent: '#F76C6C',
//       hover: '#374785',
//       hover2: '#24305E',
//     },
//   },
//   {
//     name: 'Forest Haze',
//     colors: {
//       main: '#386641',
//       highlight: '#F2E8CF',
//       accent: '#A7C957',
//       hover: '#6A994E',
//       hover2: '#BC4749',
//     },
//   },
//   {
//     name: 'Neon Night',
//     colors: {
//       main: '#22223B',
//       highlight: '#F7F7FF',
//       accent: '#9D4EDD',
//       hover: '#F72585',
//       hover2: '#4361EE',
//     },
//   },
// ];

export default function Settings({ onClose, onStartTour }: SettingsProps) {
  const { notationType, setNotationType } = useNotation();

  return (
    <div className="export-modal__content" style={{ minWidth: 320, maxWidth: 420, margin: '0 auto', padding: 0 }}>
      <button
        onClick={onClose}
        className="export-modal-btn export-modal-close"
        title="Close"
      >
        ×
      </button>
      <div style={{ padding: '32px 32px 24px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
        <h3 className="export-modal-title" style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, alignSelf: 'flex-start' }}>Settings</h3>
        {onStartTour && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: '100%', background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 20, marginBottom: 8 }}>
              <h4 style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Getting Started</h4>
              <p style={{ color: '#eee', fontSize: 15, marginBottom: 16 }}>
                New to Tonnext? Take a guided tour to learn about all the features and how to use them effectively.
              </p>
              <button
                onClick={() => { onStartTour(); onClose(); }}
                className="blend-btn export-modal__export-btn"
                style={{ width: '100%', fontSize: 20, fontWeight: 700, padding: '10px 0' }}
              >
                START TOUR
              </button>
            </div>
          </div>
        )}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ width: '100%' }}>
            <label className="export-modal-label" style={{ marginBottom: 8, display: 'block' }}>Note Labels (Current: {notationType})</label>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setNotationType('abc')}
                className={`export-modal-aspect-btn${notationType === 'abc' ? ' selected' : ''}`}
                style={{ flex: 1 }}
              >
                ABC (C, D, E...)
              </button>
              <button
                onClick={() => setNotationType('solfège')}
                className={`export-modal-aspect-btn${notationType === 'solfège' ? ' selected' : ''}`}
                style={{ flex: 1 }}
              >
                Solfège (Do, Re, Mi...)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 