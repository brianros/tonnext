import React, { useEffect, useState } from 'react';

// Colors from theme
const MAIN = 'var(--color-main)';
const HIGHLIGHT = 'var(--color-highlight)';
const ACCENT = 'var(--color-accent)';
const HOVER = 'var(--color-hover)';
const ACCENT_DARK = '#b07c6b'; // darker version of accent

// Node positions for the logo
const nodes = [
  { cx: 110, cy: 40 },   // top
  { cx: 190, cy: 180 }, // bottom right
  { cx: 30, cy: 180 },  // bottom left
];

export default function LoadingLogo() {
  // Track current and previous active nodes
  const [current, setCurrent] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPrevious(current);
      setCurrent((prev) => (prev + 1) % 3);
    }, 900); // slower animation
    return () => clearInterval(interval);
  }, [current]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.45)', // darken
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'all',
    }}>
      <svg viewBox="0 0 220 220" width={220} height={220} fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="110,40 190,180 30,180" fill={HIGHLIGHT} stroke={HOVER} strokeWidth={4} />
        {nodes.map((node, i) => (
          <circle
            key={i}
            cx={node.cx}
            cy={node.cy}
            r={28}
            fill={current === i ? ACCENT_DARK : previous === i ? ACCENT : '#e7cfc2'}
            style={{ transition: 'fill 0.35s' }}
          />
        ))}
      </svg>
    </div>
  );
} 